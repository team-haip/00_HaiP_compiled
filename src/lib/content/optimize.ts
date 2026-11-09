import { z } from "zod";
import { structured, llmAvailable, untrusted } from "@/lib/ai/llm";
import type { Extracted } from "./fetch";
import type { Analysis } from "./analyze";

const Schema = z.object({
  optimized_html: z.string(),
  summary: z.string(),
  changes: z.array(z.object({ section: z.string(), change: z.string(), reason: z.string() })),
  structural_changes: z.array(z.string()),
  preserved_facts_note: z.string(),
  structured_data_suggestion: z.string().nullable(),
});
export type Optimization = z.infer<typeof Schema> & { method: "llm" | "none" };

export async function optimizeContent(x: Extracted, analysis: Analysis, prompts: string[]): Promise<Optimization> {
  if (!llmAvailable()) throw new Error("Content optimization requires an OpenAI or Gemini API key (demo mode cannot generate HTML)");
  const sensitive = analysis.sensitive_domain !== "none";
  const r = await structured({
    name: "content_optimization",
    schema: Schema,
    system: [
      "You rewrite an existing webpage's main content into clearer, better-structured semantic HTML for human readers and search/answer engines.",
      "Rules:",
      "- Output a fragment (no <html>/<head>/<body>): use <article>, h1-h3, p, ul/ol, table, section, etc.",
      "- Preserve every verified fact, number, name, price and claim from the original exactly. Never invent claims, prices, statistics, testimonials, dates or credentials.",
      "- Improve heading hierarchy (one H1, question-style H2s where natural), readability (short paragraphs), and logical ordering.",
      "- Answer relevant customer questions ONLY when the answer is present in the original. Add an FAQ section only if at least two Q/A pairs can be fully supported by the original text; otherwise omit it.",
      "- Keep original links where relevant. Do not add external links.",
      "- structured_data_suggestion: JSON-LD string only if it strictly represents visible content; otherwise null.",
      "- Do not promise higher rankings anywhere in the output.",
      sensitive ? `- This is ${analysis.sensitive_domain} content: do not add professional advice, treatment/financial/legal recommendations, outcomes or regulated claims beyond the original.` : "",
      "- Write in the same language as the original.",
    ].join("\n"),
    user: `Tracked prompts (for relevance, not for keyword stuffing): ${JSON.stringify(prompts)}\nURL: ${x.finalUrl}\nTitle: ${x.title}\nAnalysis issues: ${JSON.stringify(analysis.issues)}\nRecommendations: ${JSON.stringify(analysis.recommendations)}\n\nOriginal main HTML:\n${untrusted(x.mainHtml.slice(0, 60_000))}`,
  });
  return { ...r, method: "llm" };
}

export function wrapHtmlDocument(fragment: string, title: string, lang = "en") {
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title.replace(/</g, "&lt;")}</title>
</head>
<body>
${fragment}
</body>
</html>
`;
}
