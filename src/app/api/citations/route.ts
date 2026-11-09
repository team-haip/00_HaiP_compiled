import { db } from "@/lib/db";
import { ok, fail, requireProject } from "@/lib/api";
import { projectHistory } from "@/lib/metrics";

export async function GET() {
  try {
    const project = await requireProject();
    const history = await projectHistory(project.id);
    const latest = history[history.length - 1] ?? null;
    const previous = history[history.length - 2] ?? null;
    const details = latest
      ? await db.citation.findMany({
          where: { result: { monitoringRunId: latest.runId } },
          include: { result: { select: { id: true, provider: true, model: true, timestamp: true, answer: true, prompt: { select: { text: true } } } } },
          orderBy: { domain: "asc" },
        })
      : [];
    const unavailable = latest
      ? await db.searchResult.count({ where: { monitoringRunId: latest.runId, status: "ok", citations: { none: {} } } })
      : 0;
    return ok({ history, latest, previous, details, answersWithoutCitations: unavailable });
  } catch (e) { return fail(e); }
}
