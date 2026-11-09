import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, requireProject } from "@/lib/api";

export async function PUT(req: Request) {
  try {
    const project = await requireProject();
    const input = z.object({
      cronExpression: z.string().trim().regex(/^(\S+\s+){4}\S+$/, "Use a 5-field cron expression"),
      timezone: z.string().trim().min(1),
      enabled: z.boolean(),
    }).parse(await req.json());
    return ok(await db.schedule.upsert({ where: { projectId: project.id }, create: { projectId: project.id, ...input }, update: input }));
  } catch (e) { return fail(e); }
}
