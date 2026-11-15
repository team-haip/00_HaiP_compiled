import { db } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { projectInput } from "@/lib/schemas";
import { normalizeDomain } from "@/lib/util";
import { newApiKey, authProject } from "@/lib/v1";

/** Create a project via API. Returns the API key once. */
export async function POST(req: Request) {
  try {
    const input = projectInput.parse(await req.json());
    const apiKey = newApiKey();
    const p = await db.project.create({
      data: {
        companyName: input.company,
        brandName: input.brand,
        website: input.website,
        domain: normalizeDomain(input.website),
        aliases: JSON.stringify(input.aliases),
        apiKey,
        competitors: { create: input.competitors.map((c) => ({ name: c.name, domain: c.domain ? normalizeDomain(c.domain) : null })) },
        prompts: { create: input.prompts.map((text) => ({ text })) },
        schedule: { create: {} },
      },
    });
    return ok({ id: p.id, brand: p.brandName, domain: p.domain, apiKey, schedule: "0 9 * * 1 Asia/Seoul", next: "GET /v1/visibility, GET /v1/pages/optimized?url=…" }, 201);
  } catch (e) { return fail(e); }
}

export async function GET(req: Request) {
  const p = await authProject(req);
  if (!p) return fail(new Error("Missing or invalid API key"), 401);
  return ok({ id: p.id, company: p.companyName, brand: p.brandName, domain: p.domain, prompts: p.prompts.map((x) => x.text), competitors: p.competitors.map((c) => c.name), schedule: p.schedule });
}
