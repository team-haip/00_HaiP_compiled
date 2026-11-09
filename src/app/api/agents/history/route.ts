import { db } from "@/lib/db";
import { ok, fail, requireProject } from "@/lib/api";
import { providerStatus } from "@/lib/env";

export async function GET() {
  try {
    const project = await requireProject();
    const runs = await db.agentRun.findMany({ where: { projectId: project.id }, orderBy: { startedAt: "desc" }, take: 30 });
    return ok({ runs, schedule: project.schedule, providers: providerStatus() });
  } catch (e) { return fail(e); }
}
