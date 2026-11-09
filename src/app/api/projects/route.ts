import { db } from "@/lib/db";
import { ok, fail, currentProject } from "@/lib/api";
import { projectInput } from "@/lib/schemas";
import { normalizeDomain } from "@/lib/util";

export async function GET() {
  try {
    return ok(await currentProject());
  } catch (e) { return fail(e); }
}

export async function POST(req: Request) {
  try {
    const input = projectInput.parse(await req.json());
    const project = await db.project.create({
      data: {
        companyName: input.company,
        brandName: input.brand,
        website: input.website,
        domain: normalizeDomain(input.website),
        aliases: JSON.stringify(input.aliases),
        competitors: { create: input.competitors.map((c) => ({ name: c.name, domain: c.domain ? normalizeDomain(c.domain) : null })) },
        prompts: { create: input.prompts.map((text) => ({ text })) },
        schedule: { create: {} },
      },
      include: { competitors: true, prompts: true, schedule: true },
    });
    return ok(project, 201);
  } catch (e) { return fail(e); }
}

export async function PUT(req: Request) {
  try {
    const existing = await currentProject();
    if (!existing) return fail(new Error("No project"), 404);
    const input = projectInput.omit({ prompts: true }).parse(await req.json());
    const project = await db.$transaction(async (tx) => {
      await tx.competitor.deleteMany({ where: { projectId: existing.id } });
      return tx.project.update({
        where: { id: existing.id },
        data: {
          companyName: input.company,
          brandName: input.brand,
          website: input.website,
          domain: normalizeDomain(input.website),
          aliases: JSON.stringify(input.aliases),
          competitors: { create: input.competitors.map((c) => ({ name: c.name, domain: c.domain ? normalizeDomain(c.domain) : null })) },
        },
        include: { competitors: true, prompts: true, schedule: true },
      });
    });
    return ok(project);
  } catch (e) { return fail(e); }
}
