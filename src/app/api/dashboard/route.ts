import { db } from "@/lib/db";
import { ok, fail, requireProject } from "@/lib/api";
import { projectHistory } from "@/lib/metrics";
import { providerStatus } from "@/lib/env";

export async function GET() {
  try {
    const project = await requireProject();
    const history = await projectHistory(project.id);
    const latest = history[history.length - 1] ?? null;
    const [pages, monitoringRuns, agentRuns, optimizations] = await Promise.all([
      db.contentPage.count({ where: { projectId: project.id } }),
      db.monitoringRun.findMany({ where: { projectId: project.id }, orderBy: { startedAt: "desc" }, take: 10 }),
      db.agentRun.findMany({ where: { projectId: project.id }, orderBy: { startedAt: "desc" }, take: 10 }),
      db.contentOptimization.findMany({ where: { page: { projectId: project.id } }, orderBy: { createdAt: "desc" }, take: 10, include: { page: { select: { url: true } } } }),
    ]);
    type Act = { at: string; kind: string; text: string; status: "ok" | "error" };
    const activity: Act[] = [
      ...monitoringRuns.map((r) => ({ at: (r.completedAt ?? r.startedAt).toISOString(), kind: "monitoring", text: r.status === "failed" ? `Monitoring failed${r.error ? `: ${r.error}` : ""}` : r.status === "running" ? "Monitoring running" : `Monitoring completed (${r.provider}) · citation report generated`, status: (r.status === "failed" ? "error" : "ok") as Act["status"] })),
      ...agentRuns.map((r) => ({ at: (r.completedAt ?? r.startedAt).toISOString(), kind: "agent", text: r.status === "failed" ? `Weekly job failed${r.error ? `: ${r.error}` : ""}` : r.status === "running" ? "Weekly job running" : `Weekly job completed (${r.trigger})${r.error ? ` with errors: ${r.error}` : ""}`, status: (r.status === "failed" ? "error" : "ok") as Act["status"] })),
      ...optimizations.map((o) => ({ at: o.createdAt.toISOString(), kind: "optimization", text: `Content optimization proposed for ${o.page.url}`, status: "ok" as const })),
    ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
    return ok({ project: { brand: project.brandName, domain: project.domain, prompts: project.prompts.filter((p) => p.active).length, competitors: project.competitors.map((c) => c.name) }, history, latest, pages, activity, providers: providerStatus() });
  } catch (e) { return fail(e); }
}
