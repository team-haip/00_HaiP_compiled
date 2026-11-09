import { db } from "./db";
import { env, log } from "./env";
import { availableProviders, groundedSearch, type Provider } from "./ai/search";
import { detectMentions } from "./ai/mentions";
import { errMsg, json } from "./util";

// ponytail: in-process lock; fine for a single Node process. Move to a DB row lock if multi-instance.
const running = new Set<string>();

export async function runMonitoring(projectId: string, opts: { trigger?: string; agentRunId?: string } = {}) {
  if (running.has(projectId)) throw new Error("A monitoring run is already in progress for this project");
  running.add(projectId);
  try {
    const project = await db.project.findUniqueOrThrow({
      where: { id: projectId },
      include: { competitors: true, prompts: { where: { active: true } } },
    });
    if (project.prompts.length === 0) throw new Error("No active prompts to monitor");
    const providers: Provider[] = env.demoMode || availableProviders().length === 0 ? ["openai", "gemini"] : availableProviders();
    const run = await db.monitoringRun.create({
      data: { projectId, provider: providers.join(","), status: "running", trigger: opts.trigger ?? "manual", agentRunId: opts.agentRunId },
    });
    log("monitor.start", { runId: run.id, providers, prompts: project.prompts.length });
    const target = { name: project.brandName, aliases: json<string[]>(project.aliases, []), domain: project.domain };
    const competitors = project.competitors.map((c) => ({ name: c.name, domain: c.domain }));
    let ok = 0, failed = 0;

    for (const prompt of project.prompts) {
      // Providers run in parallel per prompt; prompts run sequentially to stay within rate limits.
      await Promise.all(
        providers.map(async (provider) => {
          try {
            const a = await groundedSearch(provider, prompt.text, { brand: project.brandName, competitors: competitors.map((c) => c.name) });
            const m = await detectMentions(a.answer, target, competitors);
            await db.searchResult.create({
              data: {
                monitoringRunId: run.id,
                promptId: prompt.id,
                provider,
                model: a.model,
                answer: a.answer,
                status: "ok",
                targetMentioned: m.targetMentioned,
                uncertain: m.uncertain,
                mentionedBrands: JSON.stringify(m.mentionedBrands),
                targetPosition: m.targetPosition,
                citations: { create: a.citations.map((c) => ({ url: c.url, domain: c.domain, title: c.title })) },
              },
            });
            ok++;
          } catch (e) {
            failed++;
            log("monitor.result_failed", { provider, prompt: prompt.text, error: errMsg(e) });
            await db.searchResult.create({
              data: { monitoringRunId: run.id, promptId: prompt.id, provider, model: "", answer: "", status: "error", error: errMsg(e) },
            });
          }
        }),
      );
    }
    const status = ok === 0 ? "failed" : "completed";
    await db.monitoringRun.update({
      where: { id: run.id },
      data: { status, completedAt: new Date(), error: ok === 0 ? "All searches failed" : null },
    });
    log("monitor.done", { runId: run.id, ok, failed });
    return { runId: run.id, status, ok, failed };
  } finally {
    running.delete(projectId);
  }
}
