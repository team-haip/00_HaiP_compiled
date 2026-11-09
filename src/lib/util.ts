export function normalizeDomain(input: string): string {
  let s = input.trim().toLowerCase();
  if (!s) return "";
  if (!/^https?:\/\//.test(s)) s = "https://" + s;
  try {
    const h = new URL(s).hostname;
    return h.replace(/^www\./, "");
  } catch {
    return input.trim().toLowerCase().replace(/^www\./, "").split("/")[0];
  }
}

export function normalizeUrl(u: string): string | null {
  try {
    const url = new URL(u.trim());
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"].forEach((p) =>
      url.searchParams.delete(p),
    );
    return url.toString();
  } catch {
    return null;
  }
}

export function domainMatches(citedDomain: string, target: string): boolean {
  if (!target) return false;
  return citedDomain === target || citedDomain.endsWith("." + target);
}

export async function withRetry<T>(fn: () => Promise<T>, tries = 2, delayMs = 800): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i < tries - 1) await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw last;
}

export function withTimeout<T>(p: Promise<T>, ms: number, label = "operation"): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

export function json<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

export function isoWeekKey(d = new Date(), tz = "Asia/Seoul"): string {
  // Week key in the schedule's timezone, used for idempotent weekly runs.
  const local = new Date(d.toLocaleString("en-US", { timeZone: tz }));
  const date = new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
