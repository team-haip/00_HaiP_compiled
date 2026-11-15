import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fail } from "@/lib/api";
import { log } from "@/lib/env";
import { analyzePage, optimizePage } from "@/lib/content/service";
import { urlSchema } from "@/lib/schemas";
import { authProject, unauthorized } from "@/lib/v1";
import { errMsg } from "@/lib/util";

export const maxDuration = 300;

const MAX_AGE_DAYS = 7;
// ponytail: in-process set; one generation per url at a time. Use a DB status row for multi-instance.
const generating = new Set<string>();

async function generate(projectId: string, url: string) {
  const key = projectId + "|" + url;
  if (generating.has(key)) return;
  generating.add(key);
  try {
    const r = await analyzePage(projectId, url);
    await optimizePage(r.page.id, "api");
  } catch (e) {
    log("v1.optimized.generate_failed", { url, error: errMsg(e) });
    throw e;
  } finally {
    generating.delete(key);
  }
}

/**
 * GET /v1/pages/optimized?url=https://…&format=html|json&wait=1
 * Returns the latest optimized HTML for a page. If none exists or it is older than 7 days,
 * generation starts and the call returns 202 (or waits when wait=1). The weekly agent refreshes it afterwards.
 */
export async function GET(req: Request) {
  try {
    const p = await authProject(req);
    if (!p) return unauthorized();
    const sp = new URL(req.url).searchParams;
    const parsed = urlSchema.safeParse(sp.get("url") ?? "");
    if (!parsed.success) return fail(new Error("url query parameter must be a valid http(s) URL"), 400);
    const url = parsed.data;
    const wait = sp.get("wait") === "1";
    const format = sp.get("format") === "json" ? "json" : "html";

    const load = () => db.contentPage.findUnique({ where: { projectId_url: { projectId: p.id, url } }, include: { optimizations: { orderBy: { createdAt: "desc" }, take: 1 } } });
    let page = await load();
    let opt = page?.optimizations[0] ?? null;
    const stale = !opt || Date.now() - opt.createdAt.getTime() > MAX_AGE_DAYS * 86_400_000;

    if (stale) {
      if (wait) {
        await generate(p.id, url);
        page = await load();
        opt = page?.optimizations[0] ?? null;
      } else {
        void generate(p.id, url).catch(() => {});
        if (!opt) return NextResponse.json({ status: "generating", url, retryAfterSeconds: 60, hint: "Add wait=1 to block until ready" }, { status: 202, headers: { "retry-after": "60" } });
      }
    }
    if (!opt) return fail(new Error("Optimization could not be generated"), 500);

    const headers = {
      "x-geo-generated-at": opt.createdAt.toISOString(),
      "x-geo-stale": String(stale),
      "x-geo-optimization-id": opt.id,
      "cache-control": "private, max-age=300",
    };
    if (format === "json") {
      return NextResponse.json({ url, generatedAt: opt.createdAt, stale, optimizationId: opt.id, summary: opt.summary, html: opt.optimizedHtml, changes: JSON.parse(opt.changes), recommendations: JSON.parse(opt.recommendations) }, { headers });
    }
    return new NextResponse(opt.optimizedHtml, { headers: { ...headers, "content-type": "text/html; charset=utf-8" } });
  } catch (e) { return fail(e); }
}
