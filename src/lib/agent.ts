import { db } from "./db";
import { log, providerStatus } from "./env";
import { runMonitoring } from "./monitor";
import { runMetrics, projectHistory, type RunMetrics } from "./metrics";
import { analyzePage, optimizePage } from "./content/service";
import { errMsg, isoWeekKey, json } from "./util";

type Step = { step: string; status: "ok" | "skipped" | "failed"; startedAt: string; endedAt?: string; detail?: unknown; error?: string };

export type WeeklySummary = {
  periodKey: string;
  baseline: boolean;
  demoMode: boolean;
  monitoring: { runId: string; evaluated: number; errors: number; brandMentionRate: number | null; shareOfMentions: number | null; targetCitationRate: number | null } | null;
  changes: { metric: string; previous: number | null; current: number | null; delta: number | null; meaningful: boolean; direction: "up" | "down" | "flat" }[];
  citationChanges: { newDomains: string[]; lostDomains: string[] };
  opportunities: string[];
  proposals: { pageId: string; url: string; optimizationId?: string; error?: string }[];
  status: string;
};

// Differences below this are treated as noise (rates are 0..1). ponytail: fixed threshold; make it depend on sample size if prompts grow.
const NOISE = 0.1;

function diff(metric: string, prev: number | null | undefined, cur: number | null | undefined): WeeklySummary["changes"][number] {
  const p = prev ?? null, c = cur ?? null;
  const delta = p !== null && c !== null ? c - p : null;
  return { metric, previous: p, current: c, delta, meaningful: delta !== null && Math.abs(delta) >= NOISE, direction: delta === null || Math.abs(delta) < 0.005 ? "flat" : delta > 0 ? "up" : "down" };
}

export async function runWeeklyAgent(projectId: string, opts: { trigger: "manual" | "cron"; periodKey?: string }) {
  const schedule = await db.schedule.findUnique({ where: { projectId } });
  const periodKey = opts.periodKey ?? (opts.trigger === "cron" ? isoWeekKey(new Date(), schedule?.timezone ?? "Asia/Seoul") : null);
  if (periodKey) {
    const dup = await db.agentRun.findUnique({ where: { projectId_periodKey: { projectId, periodKey } } });
    if (dup) return { agentRunId: dup.id, duplicate: true as const };
  }
  const active = await db.agentRun.findFirst({ where: { projectId, status: "running" } });
  if (active) throw new Error("An agent run is already in progress");

  const run = await db.agentRun.create({ data: { projectId, status: "running", trigger: opts.trigger, periodKey } });
  const steps: Step[] = [];
  const save = () => db.agentRun.update({ where: { id: run.id }, data: { executionLogs: JSON.stringify(steps) } });
  const step = async <T>(name: string, fn: () => Promise<T>): Promise<T | undefined> => {
    const s: Step = { step: name, status: "ok", startedAt: new Date().toISOString() };
    steps.push(s);
    try {
      const r = await fn();
      s.detail = r;
      return r;
    } catch (e) {
      s.status = "failed";
      s.error = errMsg(e);
      log("agent.step_failed", { runId: run.id, step: name, error: s.error });
      return undefined;
    } finally {
      s.endedAt = new Date().toISOString();
      await save();
    }
  };

  log("agent.start", { runId: run.id, trigger: opts.trigger, periodKey });
  const summary: WeeklySummary = { periodKey: periodKey ?? isoWeekKey(), baseline: true, demoMode: providerStatus().demo, monitoring: null, changes: [], citationChanges: { newDomains: [], lostDomains: [] }, opportunities: [], proposals: [], status: "running" };

  // 1. Monitor
  const previous = (await projectHistory(projectId, 1))[0] as RunMetrics | undefined;
  const mon = await step("monitor", () => runMonitoring(projectId, { trigger: "agent", agentRunId: run.id }));
  // 2. Analyze
  const current = mon ? await step("analyze", async () => (await runMetrics(mon.runId))!) : undefined;
  if (current) {
    summary.monitoring = { runId: current.runId, evaluated: current.evaluated, errors: current.errors, brandMentionRate: current.brandMentionRate, shareOfMentions: current.shareOfMentions, targetCitationRate: current.citations.targetCitationRate };
  }
  // 3. Detect
  await step("detect", async () => {
    if (!current || !previous) { summary.baseline = true; return { baseline: true, reason: previous ? "monitoring failed" : "no previous successful run" }; }
    summary.baseline = false;
    summary.changes = [
      diff("brandMentionRate", previous.brandMentionRate, current.brandMentionRate),
      diff("shareOfMentions", previous.shareOfMentions, current.shareOfMentions),
      diff("targetCitationRate", previous.citations.targetCitationRate, current.citations.targetCitationRate),
    ];
    const prevD = new Set(previous.citations.topDomains.map((d) => d.domain));
    const curD = new Set(current.citations.topDomains.map((d) => d.domain));
    summary.citationChanges = { newDomains: [...curD].filter((d) => !prevD.has(d)), lostDomains: [...prevD].filter((d) => !curD.has(d)) };
    return { changes: summary.changes, citationChanges: summary.citationChanges };
  });
  // 4. Recommend
  const pages = await db.contentPage.findMany({ where: { projectId }, orderBy: { lastAnalyzedAt: "desc" } });
  await step("recommend", async () => {
    const ops: string[] = [];
    if (current) {
      if (current.citations.targetCitationRate !== null && current.citations.targetCitationRate < 0.5) ops.push(`Target domain cited in ${Math.round(current.citations.targetCitationRate * 100)}% of cited answers; registered pages are candidates for a content refresh.`);
      if (current.brandMentionRate !== null && current.brandMentionRate < 0.5) ops.push(`Brand mentioned in ${Math.round(current.brandMentionRate * 100)}% of evaluated answers.`);
      for (const c of current.competitorRates) if (current.brandMentionRate !== null && c.rate > current.brandMentionRate + NOISE) ops.push(`${c.name} is mentioned more often (${Math.round(c.rate * 100)}%) than the target brand.`);
      const top = current.citations.topDomains.slice(0, 3).map((d) => d.domain).join(", ");
      if (top) ops.push(`Most cited domains this run: ${top}.`);
    }
    for (const m of summary.changes) if (m.meaningful && m.direction === "down") ops.push(`${m.metric} dropped by ${Math.round(Math.abs(m.delta!) * 100)} points since the previous run.`);
    for (const p of pages) {
      const a = json<{ issues?: { severity: string }[] }>(p.analysis, {});
      const high = (a.issues ?? []).filter((i) => i.severity === "high").length;
      if (high) ops.push(`${p.url}: ${high} high-severity issue(s) in the last analysis.`);
    }
    if (pages.length === 0) ops.push("No pages registered for optimization yet. Analyze a page in Content Optimization to include it in weekly refresh proposals.");
    summary.opportunities = ops;
    return ops;
  });
  // 5. Optimize (max 3 pages per run to bound cost)
  await step("optimize", async () => {
    if (providerStatus().demo) return { skipped: "demo mode — no LLM key" };
    for (const p of pages.slice(0, 3)) {
      try {
        await analyzePage(projectId, p.url);
        const o = await optimizePage(p.id, "agent");
        summary.proposals.push({ pageId: p.id, url: p.url, optimizationId: o.id });
      } catch (e) {
        summary.proposals.push({ pageId: p.id, url: p.url, error: errMsg(e) });
      }
    }
    return summary.proposals;
  });
  // 6. Report
  const failed = steps.filter((s) => s.status === "failed").map((s) => s.step);
  summary.status = mon ? (failed.length ? "completed_with_errors" : "completed") : "failed";
  await db.agentRun.update({
    where: { id: run.id },
    data: { status: mon ? "completed" : "failed", completedAt: new Date(), summary: JSON.stringify(summary), executionLogs: JSON.stringify(steps), error: failed.length ? `Failed steps: ${failed.join(", ")}` : null },
  });
  if (schedule) await db.schedule.update({ where: { projectId }, data: { lastRunAt: new Date() } });
  log("agent.done", { runId: run.id, status: summary.status });
  return { agentRunId: run.id, duplicate: false as const, summary };
}
