import { ok, fail, requireProject } from "@/lib/api";
import { runWeeklyAgent } from "@/lib/agent";

export const maxDuration = 600;

export async function POST() {
  try {
    const project = await requireProject();
    return ok(await runWeeklyAgent(project.id, { trigger: "manual" }));
  } catch (e) { return fail(e, 409); }
}
