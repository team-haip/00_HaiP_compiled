import * as cheerio from "cheerio";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { withTimeout } from "@/lib/util";

export type Extracted = {
  url: string;
  finalUrl: string;
  title: string;
  metaDescription: string;
  canonical: string | null;
  headings: { level: number; text: string }[];
  text: string;
  structuredData: unknown[];
  links: { href: string; text: string }[];
  mainHtml: string;
  fetchedAt: string;
};

const MAX_BYTES = 2_000_000;
const TIMEOUT = 15_000;

function isPrivateIp(ip: string): boolean {
  if (ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80")) return true;
  const m = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return ip.startsWith("::ffff:") ? isPrivateIp(ip.slice(7)) : false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try { u = new URL(raw); } catch { throw new Error("Invalid URL"); }
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("Only http/https URLs are allowed");
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("Internal hostnames are not allowed");
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new Error("Private network addresses are not allowed");
  } else {
    const addrs = await lookup(host, { all: true }).catch(() => []);
    if (addrs.length === 0) throw new Error(`Could not resolve host ${host}`);
    if (addrs.some((a) => isPrivateIp(a.address))) throw new Error("Host resolves to a private network address");
  }
  return u;
}

export async function fetchPage(raw: string): Promise<Extracted> {
  const u = await assertPublicUrl(raw);
  const res = await withTimeout(
    fetch(u, {
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; GEO-Agent/0.1; +https://github.com/team-haip)", accept: "text/html,*/*" },
      signal: AbortSignal.timeout(TIMEOUT),
    }),
    TIMEOUT + 1000,
    "page fetch",
  );
  if (res.status === 403 || res.status === 401 || res.status === 429) {
    throw new Error(`The site blocked automated access (HTTP ${res.status}). Try another public page or paste the HTML manually.`);
  }
  if (!res.ok) throw new Error(`Fetch failed with HTTP ${res.status}`);
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("html") && !ct.includes("xml")) throw new Error(`Not an HTML page (content-type: ${ct || "unknown"})`);
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES) throw new Error("Page is larger than the 2MB limit");
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) throw new Error("Page is larger than the 2MB limit");
  await assertPublicUrl(res.url); // redirect target must be public too
  return extract(new TextDecoder().decode(buf), u.toString(), res.url);
}

export function extract(html: string, url: string, finalUrl = url): Extracted {
  const $ = cheerio.load(html);
  const structuredData: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try { structuredData.push(JSON.parse($(el).text())); } catch { /* ignore malformed */ }
  });
  const title = $("title").first().text().trim() || $("h1").first().text().trim();
  const metaDescription = $('meta[name="description"]').attr("content")?.trim() ?? "";
  const canonical = $('link[rel="canonical"]').attr("href") ?? null;

  // Strip chrome before picking the main content.
  $("script, style, noscript, iframe, svg, nav, footer, header, aside, form, [role=navigation], [role=banner], [role=contentinfo], .nav, .navbar, .footer, .sidebar, .menu, .cookie, .popup").remove();
  const candidates = ["main", "article", "[role=main]", "#content", ".content", ".post", ".entry-content", "body"];
  let $main = $("body") as cheerio.Cheerio<ReturnType<typeof $>["0"]>;
  for (const sel of candidates) {
    const el = $(sel).first();
    if (el.length && el.text().trim().length > 200) { $main = el; break; }
  }
  const headings: Extracted["headings"] = [];
  $main.find("h1,h2,h3").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text) headings.push({ level: Number(el.tagName[1]), text });
  });
  const links: Extracted["links"] = [];
  $main.find("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (/^https?:/.test(href) && text && links.length < 40) links.push({ href, text });
  });
  const text = $main.text().replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim().slice(0, 30_000);
  const mainHtml = ($main.html() ?? "").trim().slice(0, 200_000);
  return { url, finalUrl, title, metaDescription, canonical, headings, text, structuredData, links, mainHtml, fetchedAt: new Date().toISOString() };
}
