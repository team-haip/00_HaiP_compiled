import { db } from "@/lib/db";
import { ok, fail } from "@/lib/api";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const p = await db.project.findUnique({ where: { id }, include: { competitors: true, prompts: true, schedule: true } });
    return p ? ok(p) : fail(new Error("Not found"), 404);
  } catch (e) { return fail(e); }
}
