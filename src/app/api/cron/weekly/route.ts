import { db } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { env, log } from "@/lib/env";
import { runWeeklyAgent } from "@/lib/agent";

export const maxDuration = 600;

/**
 * External-scheduler entry point (e.g. Vercel Cron, GitHub Actions, crontab).
 * Auth: `Authorization: Bearer $CRON_SECRET`. Idempotent per ISO week per project.
 * Nothing calls this automatically unless you configure a scheduler — see README.
 */
export async function POST(req: Request) {
  if (!env.cronSecret) return fail(new Error("CRON_SECRET is not configured"), 503);
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env.cronSecret}`) return fail(new Error("Unauthorized"), 401);
  try {
    const schedules = await db.schedule.findMany({ where: { enabled: true } });
    const results = [];
    for (const s of schedules) {
      try {
        const r = await runWeeklyAgent(s.projectId, { trigger: "cron" });
        results.push({ projectId: s.projectId, agentRunId: r.agentRunId, duplicate: r.duplicate });
      } catch (e) {
        results.push({ projectId: s.projectId, error: String(e) });
      }
    }
    log("cron.weekly", { projects: schedules.length });
    return ok({ results });
  } catch (e) { return fail(e); }
}

export const GET = POST;
