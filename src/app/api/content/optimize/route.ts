import { z } from "zod";
import { ok, fail } from "@/lib/api";
import { optimizePage } from "@/lib/content/service";

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const { pageId } = z.object({ pageId: z.string() }).parse(await req.json());
    return ok(await optimizePage(pageId));
  } catch (e) { return fail(e, 422); }
}
