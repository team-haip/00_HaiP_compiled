import { db } from "@/lib/db";
import { ok, fail, requireProject } from "@/lib/api";

export async function GET(req: Request) {
  try {
    const project = await requireProject();
    const id = new URL(req.url).searchParams.get("id");
    if (id) {
      const o = await db.contentOptimization.findUnique({ where: { id }, include: { page: true } });
      return o ? ok(o) : fail(new Error("Not found"), 404);
    }
    const pages = await db.contentPage.findMany({
      where: { projectId: project.id },
      orderBy: { lastAnalyzedAt: "desc" },
      include: { optimizations: { orderBy: { createdAt: "desc" }, select: { id: true, createdAt: true, summary: true, trigger: true } } },
    });
    return ok(pages.map((p) => ({ ...p, extracted: undefined })));
  } catch (e) { return fail(e); }
}
