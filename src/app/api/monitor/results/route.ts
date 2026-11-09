import { db } from "@/lib/db";
import { ok, fail, requireProject } from "@/lib/api";
import { projectHistory } from "@/lib/metrics";

export async function GET(req: Request) {
  try {
    const project = await requireProject();
    const runId = new URL(req.url).searchParams.get("runId");
    const history = await projectHistory(project.id);
    const latest = runId ? history.find((h) => h.runId === runId) : history[history.length - 1];
    const results = latest
      ? await db.searchResult.findMany({ where: { monitoringRunId: latest.runId }, include: { prompt: true, citations: true }, orderBy: [{ promptId: "asc" }, { provider: "asc" }] })
      : [];
    return ok({ history, latest: latest ?? null, results });
  } catch (e) { return fail(e); }
}
