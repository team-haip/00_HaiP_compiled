import { z } from "zod";
import { structured, llmAvailable, untrusted } from "./llm";
import { log } from "@/lib/env";

export type BrandDef = { name: string; aliases?: string[]; domain?: string | null };

export type MentionResult = {
  targetMentioned: boolean;
  uncertain: boolean;
  mentionedBrands: string[];
  targetPosition: number | null;
  method: "llm" | "heuristic";
};

const Schema = z.object({
  target_brand_mentioned: z.boolean(),
  confidence: z.enum(["high", "medium", "low"]),
  mentioned_brands: z.array(z.string()),
  target_brand_position: z.number().nullable(),
});

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Deterministic alias/domain matcher. Used as the fallback and as a cross-check for the LLM. */
export function heuristicMentions(answer: string, target: BrandDef, competitors: BrandDef[]): MentionResult {
  const lower = answer.toLowerCase();
  const find = (b: BrandDef) => {
    const terms = [b.name, ...(b.aliases ?? []), b.domain ?? ""].filter((t) => t && t.length >= 3);
    let first = -1;
    for (const t of terms) {
      const i = lower.search(new RegExp(`(^|[^a-z0-9])${escapeRe(t.toLowerCase())}`));
      if (i >= 0 && (first < 0 || i < first)) first = i;
    }
    return first;
  };
  const found = [target, ...competitors]
    .map((b) => ({ name: b.name, idx: find(b) }))
    .filter((x) => x.idx >= 0)
    .sort((a, b) => a.idx - b.idx);
  const pos = found.findIndex((x) => x.name === target.name);
  return {
    targetMentioned: pos >= 0,
    uncertain: false,
    mentionedBrands: found.map((x) => x.name),
    targetPosition: pos >= 0 ? pos + 1 : null,
    method: "heuristic",
  };
}

export async function detectMentions(
  answer: string,
  target: BrandDef,
  competitors: BrandDef[],
): Promise<MentionResult> {
  const h = heuristicMentions(answer, target, competitors);
  if (!llmAvailable() || !answer.trim()) return h;
  try {
    const r = await structured({
      name: "brand_mentions",
      schema: Schema,
      system:
        "You extract brand mentions from an AI search answer. Return only brands from the provided list that are clearly mentioned (use aliases/domains to resolve names). target_brand_position is the 1-based order of the target among all listed brands in the answer, or null. Set confidence to low when identification is ambiguous. Never guess.",
      user: `Target brand: ${JSON.stringify(target)}\nCompetitors: ${JSON.stringify(competitors)}\n\nAnswer:\n${untrusted(answer)}`,
    });
    const known = new Set([target.name, ...competitors.map((c) => c.name)]);
    const brands = r.mentioned_brands.filter((b) => known.has(b));
    const uncertain = r.confidence === "low" || r.target_brand_mentioned !== h.targetMentioned;
    return {
      targetMentioned: r.target_brand_mentioned,
      uncertain,
      mentionedBrands: Array.from(new Set([...brands, ...(r.target_brand_mentioned ? [target.name] : [])])),
      targetPosition: r.target_brand_position,
      method: "llm",
    };
  } catch (e) {
    log("mentions.llm_failed", { error: String(e) });
    return { ...h, uncertain: true };
  }
}
