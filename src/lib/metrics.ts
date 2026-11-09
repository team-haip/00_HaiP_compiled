import { db } from "./db";
import { domainMatches, json } from "./util";

export type RunMetrics = {
  runId: string;
  startedAt: string;
  completedAt: string | null;
  status: string;
  evaluated: number; // successfully evaluated answers
  errors: number;
  uncertain: number;
  brandMentionRate: number | null; // answers mentioning target / evaluated
  shareOfMentions: number | null; // target mentions / all brand mentions (target + competitors)
  competitorRates: { name: string; rate: number; count: number }[];
  byProvider: { provider: string; evaluated: number; mentionRate: number | null; citationRate: number | null }[];
  citations: { total: number; uniqueDomains: number; targetCitationRate: number | null; topDomains: { domain: string; count: number; share: number }[] };
};

export async function runMetrics(runId: string): Promise<RunMetrics | null> {
  const run = await db.monitoringRun.findUnique({
    where: { id: runId },
    include: { results: { include: { citations: true } }, project: { include: { competitors: true } } },
  });
  if (!run) return null;
  const okResults = run.results.filter((r) => r.status === "ok");
  const evaluated = okResults.length;
  const competitors = run.project.competitors.map((c) => c.name);
  const targetCount = okResults.filter((r) => r.targetMentioned).length;
  const compCounts = competitors.map((name) => ({
    name,
    count: okResults.filter((r) => json<string[]>(r.mentionedBrands, []).includes(name)).length,
  }));
  const allMentions = targetCount + compCounts.reduce((s, c) => s + c.count, 0);

  const providers = Array.from(new Set(run.results.map((r) => r.provider)));
  const byProvider = providers.map((provider) => {
    const rs = okResults.filter((r) => r.provider === provider);
    const withCit = rs.filter((r) => r.citations.length > 0);
    return {
      provider,
      evaluated: rs.length,
      mentionRate: rs.length ? rs.filter((r) => r.targetMentioned).length / rs.length : null,
      citationRate: withCit.length ? withCit.filter((r) => r.citations.some((c) => domainMatches(c.domain, run.project.domain))).length / withCit.length : null,
    };
  });

  const cits = okResults.flatMap((r) => r.citations);
  const domainCount = new Map<string, number>();
  for (const c of cits) domainCount.set(c.domain, (domainCount.get(c.domain) ?? 0) + 1);
  const answersWithCitations = okResults.filter((r) => r.citations.length > 0);
  const targetCited = answersWithCitations.filter((r) => r.citations.some((c) => domainMatches(c.domain, run.project.domain))).length;
  const topDomains = Array.from(domainCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([domain, count]) => ({ domain, count, share: cits.length ? count / cits.length : 0 }));

  return {
    runId: run.id,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    status: run.status,
    evaluated,
    errors: run.results.length - evaluated,
    uncertain: okResults.filter((r) => r.uncertain).length,
    brandMentionRate: evaluated ? targetCount / evaluated : null,
    shareOfMentions: allMentions ? targetCount / allMentions : null,
    competitorRates: compCounts.map((c) => ({ ...c, rate: evaluated ? c.count / evaluated : 0 })),
    byProvider,
    citations: {
      total: cits.length,
      uniqueDomains: domainCount.size,
      targetCitationRate: answersWithCitations.length ? targetCited / answersWithCitations.length : null,
      topDomains,
    },
  };
}

export async function projectHistory(projectId: string, limit = 20): Promise<RunMetrics[]> {
  const runs = await db.monitoringRun.findMany({
    where: { projectId, status: { in: ["completed", "failed"] } },
    orderBy: { startedAt: "desc" },
    take: limit,
    select: { id: true },
  });
  const out: RunMetrics[] = [];
  for (const r of runs) {
    const m = await runMetrics(r.id);
    if (m) out.push(m);
  }
  return out.reverse();
}
