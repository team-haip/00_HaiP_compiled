import { db } from "@/lib/db";
import { ok, fail, requireProject } from "@/lib/api";
import { newApiKey } from "@/lib/v1";

/** Dashboard-only: show or rotate the project's API key. */
export async function GET() {
  try {
    const p = await requireProject();
    return ok({ apiKey: p.apiKey });
  } catch (e) { return fail(e); }
}

export async function POST() {
  try {
    const p = await requireProject();
    const u = await db.project.update({ where: { id: p.id }, data: { apiKey: newApiKey() } });
    return ok({ apiKey: u.apiKey });
  } catch (e) { return fail(e); }
}
