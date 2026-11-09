import { db } from "@/lib/db";
import { log } from "@/lib/env";
import { fetchPage, type Extracted } from "./fetch";
import { analyzeContent, type Analysis } from "./analyze";
import { optimizeContent } from "./optimize";
import { json } from "@/lib/util";

export async function analyzePage(projectId: string, url: string) {
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId }, include: { prompts: { where: { active: true } } } });
  const extracted = await fetchPage(url);
  const analysis = await analyzeContent(extracted, project.prompts.map((p) => p.text));
  const page = await db.contentPage.upsert({
    where: { projectId_url: { projectId, url } },
    create: { projectId, url, title: extracted.title, analysis: JSON.stringify(analysis), extracted: JSON.stringify(extracted), lastAnalyzedAt: new Date() },
    update: { title: extracted.title, analysis: JSON.stringify(analysis), extracted: JSON.stringify(extracted), lastAnalyzedAt: new Date() },
  });
  log("content.analyzed", { pageId: page.id, url, issues: analysis.issues.length, method: analysis.method });
  return { page, extracted, analysis };
}

export async function optimizePage(pageId: string, trigger = "manual") {
  const page = await db.contentPage.findUniqueOrThrow({ where: { id: pageId }, include: { project: { include: { prompts: { where: { active: true } } } } } });
  const extracted = json<Extracted | null>(page.extracted, null);
  const analysis = json<Analysis | null>(page.analysis, null);
  if (!extracted || !analysis) throw new Error("Analyze the page first");
  const opt = await optimizeContent(extracted, analysis, page.project.prompts.map((p) => p.text));
  const rec = await db.contentOptimization.create({
    data: {
      contentPageId: page.id,
      originalHtml: extracted.mainHtml,
      optimizedHtml: opt.optimized_html,
      recommendations: JSON.stringify({ recommendations: analysis.recommendations, issues: analysis.issues, structured_data_suggestion: opt.structured_data_suggestion, preserved_facts_note: opt.preserved_facts_note }),
      changes: JSON.stringify({ changes: opt.changes, structural_changes: opt.structural_changes }),
      summary: opt.summary,
      trigger,
    },
  });
  log("content.optimized", { pageId: page.id, optimizationId: rec.id, trigger });
  return rec;
}
