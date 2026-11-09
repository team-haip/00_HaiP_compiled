import { z } from "zod";
import { structured, llmAvailable, untrusted } from "@/lib/ai/llm";
import type { Extracted } from "./fetch";

export const AnalysisSchema = z.object({
  summary: z.string(),
  issues: z.array(
    z.object({
      type: z.enum([
        "content_structure",
        "heading_hierarchy",
        "information_gap",
        "readability",
        "factual_consistency",
        "structured_data",
        "search_accessibility",
        "prompt_relevance",
      ]),
      severity: z.enum(["low", "medium", "high"]),
      description: z.string(),
    }),
  ),
  recommendations: z.array(z.string()),
  answered_questions: z.array(z.string()),
  unanswered_questions: z.array(z.string()),
  sensitive_domain: z.enum(["none", "medical", "financial", "legal"]),
});
export type Analysis = z.infer<typeof AnalysisSchema> & { method: "llm" | "heuristic" };

/** Deterministic checks that work without any API key. */
export function heuristicAnalysis(x: Extracted): Analysis {
  const issues: Analysis["issues"] = [];
  const recs: string[] = [];
  const h1s = x.headings.filter((h) => h.level === 1);
  if (h1s.length === 0) { issues.push({ type: "heading_hierarchy", severity: "high", description: "The page has no H1 heading." }); recs.push("Add a single descriptive H1."); }
  if (h1s.length > 1) issues.push({ type: "heading_hierarchy", severity: "medium", description: `The page has ${h1s.length} H1 headings.` });
  let prev = 0;
  for (const h of x.headings) { if (prev && h.level > prev + 1) { issues.push({ type: "heading_hierarchy", severity: "low", description: `Heading level jumps from H${prev} to H${h.level} ("${h.text.slice(0, 40)}").` }); break; } prev = h.level; }
  if (!x.metaDescription) { issues.push({ type: "search_accessibility", severity: "medium", description: "Missing meta description." }); recs.push("Write a meta description that summarizes the page in one or two sentences."); }
  if (!x.canonical) issues.push({ type: "search_accessibility", severity: "low", description: "No canonical URL declared." });
  if (x.structuredData.length === 0) { issues.push({ type: "structured_data", severity: "low", description: "No JSON-LD structured data found." }); recs.push("Add JSON-LD only for facts visible on the page (e.g. Organization, Article)."); }
  const words = x.text.split(/\s+/).length;
  if (words < 300) issues.push({ type: "information_gap", severity: "medium", description: `Main content is short (${words} words).` });
  if (x.headings.length < 3 && words > 600) { issues.push({ type: "content_structure", severity: "medium", description: "Long content with few headings; questions are not separated into sections." }); recs.push("Split the content into sections with question-style H2 headings."); }
  const sentences = x.text.split(/[.!?。]\s/).filter(Boolean);
  const avg = sentences.length ? words / sentences.length : 0;
  if (avg > 30) issues.push({ type: "readability", severity: "low", description: `Average sentence length is ${Math.round(avg)} words.` });
  return { summary: `Heuristic analysis of ${x.finalUrl}: ${words} words, ${x.headings.length} headings.`, issues, recommendations: recs, answered_questions: [], unanswered_questions: [], sensitive_domain: "none", method: "heuristic" };
}

export async function analyzeContent(x: Extracted, prompts: string[]): Promise<Analysis> {
  const h = heuristicAnalysis(x);
  if (!llmAvailable()) return h;
  const r = await structured({
    name: "content_analysis",
    schema: AnalysisSchema,
    system:
      "You are a GEO (generative engine optimization) content auditor. Evaluate the page on: content structure, heading hierarchy, information completeness, readability, factual consistency, structured data, search accessibility signals, and relevance to the tracked search prompts. Be concrete and cite what is actually on the page. Do not promise rankings. List questions the page already answers and relevant questions it does not answer (do not invent answers). Flag medical/financial/legal content in sensitive_domain.",
    user: `Tracked prompts: ${JSON.stringify(prompts)}\nURL: ${x.finalUrl}\nTitle: ${x.title}\nMeta description: ${x.metaDescription}\nCanonical: ${x.canonical}\nHeadings: ${JSON.stringify(x.headings)}\nStructured data types: ${JSON.stringify(x.structuredData.map((d) => (d as { "@type"?: unknown })["@type"] ?? "unknown"))}\n\nMain text:\n${untrusted(x.text.slice(0, 20_000))}`,
  });
  // Merge deterministic findings the model may have missed.
  const seen = new Set(r.issues.map((i) => i.type + i.description));
  return { ...r, issues: [...r.issues, ...h.issues.filter((i) => !seen.has(i.type + i.description))], method: "llm" };
}
