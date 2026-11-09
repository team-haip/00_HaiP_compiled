import { z } from "zod";
import { ok, fail, requireProject } from "@/lib/api";
import { analyzePage } from "@/lib/content/service";
import { urlSchema } from "@/lib/schemas";

export const maxDuration = 180;

export async function POST(req: Request) {
  try {
    const project = await requireProject();
    const { url } = z.object({ url: urlSchema }).parse(await req.json());
    const r = await analyzePage(project.id, url);
    return ok({ pageId: r.page.id, extracted: { ...r.extracted, mainHtml: undefined }, mainHtml: r.extracted.mainHtml, analysis: r.analysis });
  } catch (e) { return fail(e, 422); }
}
