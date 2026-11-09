import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { env, log } from "@/lib/env";
import { normalizeDomain, normalizeUrl, withRetry, withTimeout } from "@/lib/util";

export type Provider = "openai" | "gemini";

export type GroundedAnswer = {
  provider: Provider;
  model: string;
  answer: string;
  // Only citations returned by the provider's search metadata, never URLs parsed from answer text.
  citations: { url: string; domain: string; title?: string }[];
  citationsAvailable: boolean;
};

const SEARCH_TIMEOUT = 60_000;

let _openai: OpenAI | null = null;
export function openai() {
  if (!env.openaiKey) throw new Error("OPENAI_API_KEY is not configured");
  return (_openai ??= new OpenAI({ apiKey: env.openaiKey }));
}
let _gemini: GoogleGenAI | null = null;
export function gemini() {
  if (!env.geminiKey) throw new Error("GEMINI_API_KEY is not configured");
  return (_gemini ??= new GoogleGenAI({ apiKey: env.geminiKey }));
}

export function availableProviders(): Provider[] {
  const p: Provider[] = [];
  if (env.openaiKey) p.push("openai");
  if (env.geminiKey) p.push("gemini");
  return p;
}

async function openaiSearch(prompt: string): Promise<GroundedAnswer> {
  const res = await withTimeout(
    openai().responses.create({
      model: env.openaiModel,
      tools: [{ type: "web_search" }],
      input: prompt,
    }),
    SEARCH_TIMEOUT,
    "openai web_search",
  );
  const citations: GroundedAnswer["citations"] = [];
  for (const item of res.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.type !== "output_text") continue;
      for (const a of part.annotations ?? []) {
        if (a.type === "url_citation") {
          const url = normalizeUrl(a.url);
          if (url) citations.push({ url, domain: normalizeDomain(url), title: a.title });
        }
      }
    }
  }
  return { provider: "openai", model: env.openaiModel, answer: res.output_text ?? "", citations: dedupe(citations), citationsAvailable: true };
}

async function resolveRedirect(uri: string): Promise<string> {
  // Gemini grounding chunks come back as vertexaisearch redirect links; resolve to the real URL.
  if (!/vertexaisearch\.cloud\.google\.com/.test(uri)) return uri;
  try {
    const r = await withTimeout(fetch(uri, { method: "HEAD", redirect: "follow" }), 8_000, "redirect resolve");
    return r.url || uri;
  } catch {
    return uri;
  }
}

async function geminiSearch(prompt: string): Promise<GroundedAnswer> {
  const res = await withTimeout(
    gemini().models.generateContent({
      model: env.geminiModel,
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    }),
    SEARCH_TIMEOUT,
    "gemini googleSearch",
  );
  const meta = res.candidates?.[0]?.groundingMetadata;
  const chunks = meta?.groundingChunks ?? [];
  const citations: GroundedAnswer["citations"] = [];
  for (const c of chunks) {
    const raw = c.web?.uri;
    if (!raw) continue;
    const resolved = await resolveRedirect(raw);
    const url = normalizeUrl(resolved);
    if (!url) continue;
    let domain = normalizeDomain(url);
    // If the redirect could not be resolved, Gemini usually puts the source domain in the title.
    if (/vertexaisearch\.cloud\.google\.com/.test(domain) && c.web?.title && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(c.web.title)) {
      domain = normalizeDomain(c.web.title);
    }
    citations.push({ url, domain, title: c.web?.title ?? undefined });
  }
  return {
    provider: "gemini",
    model: env.geminiModel,
    answer: res.text ?? "",
    citations: dedupe(citations),
    citationsAvailable: meta !== undefined,
  };
}

function dedupe(c: GroundedAnswer["citations"]) {
  const seen = new Set<string>();
  return c.filter((x) => (seen.has(x.url) ? false : (seen.add(x.url), true)));
}

// ponytail: demo mode answers are fixed strings labeled [DEMO]; never shown as real search results.
function demoSearch(provider: Provider, prompt: string, brand: string, competitors: string[]): GroundedAnswer {
  const names = [brand, ...competitors].filter(Boolean);
  const answer = `[DEMO MODE — not a real ${provider} answer] For "${prompt}", commonly listed options include ${names.join(", ")}. Configure API keys to run real API-based AI search.`;
  return { provider, model: "demo", answer, citations: [], citationsAvailable: false };
}

export async function groundedSearch(
  provider: Provider,
  prompt: string,
  ctx: { brand: string; competitors: string[] },
): Promise<GroundedAnswer> {
  if (env.demoMode || (provider === "openai" && !env.openaiKey) || (provider === "gemini" && !env.geminiKey)) {
    return demoSearch(provider, prompt, ctx.brand, ctx.competitors);
  }
  log("search.start", { provider, prompt });
  const r = await withRetry(() => (provider === "openai" ? openaiSearch(prompt) : geminiSearch(prompt)), 2);
  log("search.done", { provider, prompt, citations: r.citations.length, chars: r.answer.length });
  return r;
}
