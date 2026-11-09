import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, requireProject } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const project = await requireProject();
    const { text } = z.object({ text: z.string().trim().min(3) }).parse(await req.json());
    return ok(await db.prompt.create({ data: { projectId: project.id, text } }), 201);
  } catch (e) { return fail(e); }
}

export async function PATCH(req: Request) {
  try {
    const { id, active } = z.object({ id: z.string(), active: z.boolean() }).parse(await req.json());
    return ok(await db.prompt.update({ where: { id }, data: { active } }));
  } catch (e) { return fail(e); }
}

export async function DELETE(req: Request) {
  try {
    const { id } = z.object({ id: z.string() }).parse(await req.json());
    await db.prompt.delete({ where: { id } });
    return ok({ deleted: id });
  } catch (e) { return fail(e); }
}
