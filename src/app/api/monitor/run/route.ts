import { ok, fail, requireProject } from "@/lib/api";
import { runMonitoring } from "@/lib/monitor";
import { runMetrics } from "@/lib/metrics";

export const maxDuration = 300;

export async function POST() {
  try {
    const project = await requireProject();
    const r = await runMonitoring(project.id, { trigger: "manual" });
    return ok({ ...r, metrics: await runMetrics(r.runId) });
  } catch (e) { return fail(e, 409); }
}
