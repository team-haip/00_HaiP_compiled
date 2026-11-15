import { ok, fail } from "@/lib/api";
import { projectHistory } from "@/lib/metrics";
import { authProject, unauthorized } from "@/lib/v1";
import { db } from "@/lib/db";
import { json } from "@/lib/util";
import type { WeeklySummary } from "@/lib/agent";

/** Latest API-based AI search visibility for the project, maintained by the weekly agent. */
export async function GET(req: Request) {
  try {
    const p = await authProject(req);
    if (!p) return unauthorized();
    const history = await projectHistory(p.id, 12);
    const latest = history[history.length - 1] ?? null;
    const previous = history[history.length - 2] ?? null;
    const lastAgent = await db.agentRun.findFirst({ where: { projectId: p.id, status: "completed" }, orderBy: { startedAt: "desc" } });
    const summary = json<WeeklySummary | null>(lastAgent?.summary, null);
    return ok({
      label: "API-based AI Search Visibility (not consumer ChatGPT/Gemini impressions)",
      brand: p.brandName,
      domain: p.domain,
      measuredAt: latest?.startedAt ?? null,
      baseline: !previous,
      metrics: latest
        ? {
            brandMentionRate: latest.brandMentionRate,
            shareOfMentions: latest.shareOfMentions,
            targetCitationRate: latest.citations.targetCitationRate,
            evaluatedAnswers: latest.evaluated,
            byProvider: latest.byProvider,
            competitors: latest.competitorRates,
            topCitedDomains: latest.citations.topDomains.slice(0, 10),
          }
        : null,
      changesSincePrevious: summary && !summary.baseline ? summary.changes : [],
      opportunities: summary?.opportunities ?? [],
      history: history.map((h) => ({ at: h.startedAt, brandMentionRate: h.brandMentionRate, shareOfMentions: h.shareOfMentions, targetCitationRate: h.citations.targetCitationRate })),
      lastAgentRunAt: lastAgent?.completedAt ?? null,
    });
  } catch (e) { return fail(e); }
}
