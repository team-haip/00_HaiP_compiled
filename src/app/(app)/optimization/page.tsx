"use client";
import { useState } from "react";
import { Loader2, Search, Sparkles, Copy, Download, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader, ErrorBox, Notice, fmtDate, useApi, post } from "@/components/ui-bits";
import type { Analysis } from "@/lib/content/analyze";

type Extracted = { finalUrl: string; title: string; metaDescription: string; canonical: string | null; headings: { level: number; text: string }[]; text: string; structuredData: unknown[]; links: { href: string; text: string }[] };
type AnalyzeRes = { pageId: string; extracted: Extracted; mainHtml: string; analysis: Analysis };
type Opt = { id: string; originalHtml: string; optimizedHtml: string; recommendations: string; changes: string; summary: string | null; createdAt: string; page?: { url: string; title: string | null } };
type HistoryPage = { id: string; url: string; title: string | null; lastAnalyzedAt: string | null; analysis: string | null; optimizations: { id: string; createdAt: string; summary: string | null; trigger: string }[] };

const sev: Record<string, "destructive" | "secondary" | "outline"> = { high: "destructive", medium: "secondary", low: "outline" };

function wrapDoc(fragment: string, title: string) {
  return `<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${title.replace(/</g, "&lt;")}</title>\n</head>\n<body>\n${fragment}\n</body>\n</html>\n`;
}

export default function Optimization() {
  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<AnalyzeRes | null>(null);
  const [opt, setOpt] = useState<Opt | null>(null);
  const [copied, setCopied] = useState(false);
  const history = useApi<HistoryPage[]>("/api/content/history");

  const analyze = async (u = url) => {
    setAnalyzing(true); setError(null); setOpt(null);
    try {
      let target = u.trim();
      if (!/^https?:\/\//.test(target)) target = "https://" + target;
      setUrl(target);
      setRes(await post<AnalyzeRes>("/api/content/analyze", { url: target }));
      history.reload();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setAnalyzing(false); }
  };
  const optimize = async () => {
    if (!res) return;
    setOptimizing(true); setError(null);
    try { setOpt(await post<Opt>("/api/content/optimize", { pageId: res.pageId })); history.reload(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setOptimizing(false); }
  };
  const loadOpt = async (id: string) => {
    setError(null);
    try {
      const o = await post<Opt>(`/api/content/history?id=${id}`, undefined, "GET");
      setOpt(o); setRes(null); setUrl(o.page?.url ?? "");
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const title = res?.extracted.title ?? opt?.page?.title ?? "optimized";
  const copy = async () => { if (!opt) return; await navigator.clipboard.writeText(opt.optimizedHtml); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const download = () => {
    if (!opt) return;
    const blob = new Blob([wrapDoc(opt.optimizedHtml, title)], { type: "text/html" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "optimized.html"; a.click(); URL.revokeObjectURL(a.href);
  };
  const recs = opt ? (JSON.parse(opt.recommendations) as { recommendations: string[]; issues: Analysis["issues"]; structured_data_suggestion: string | null; preserved_facts_note: string }) : null;
  const changes = opt ? (JSON.parse(opt.changes) as { changes: { section: string; change: string; reason: string }[]; structural_changes: string[] }) : null;

  return (
    <>
      <PageHeader title="Content Optimization" description="Analyze an existing public page and generate a reviewable, improved HTML version. Nothing is published automatically." />
      <Card className="mb-6">
        <CardContent className="pt-5">
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); analyze(); }}>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/blog/article" required />
            <Button type="submit" disabled={analyzing}>{analyzing ? <Loader2 className="animate-spin" /> : <Search />} Analyze Content</Button>
            <Button type="button" variant="outline" onClick={optimize} disabled={!res || optimizing}>{optimizing ? <Loader2 className="animate-spin" /> : <Sparkles />} Generate Optimization</Button>
          </form>
          {error && <div className="mt-3"><ErrorBox message={error} /></div>}
          {optimizing && <Notice className="mt-3">Generating improved HTML from the extracted content. This can take up to a minute.</Notice>}
        </CardContent>
      </Card>

      {res && !opt && (
        <div className="grid gap-4 lg:grid-cols-2 mb-6">
          <Card>
            <CardHeader><CardTitle>Original page analysis</CardTitle><CardDescription>{res.extracted.finalUrl} · {res.analysis.method === "heuristic" ? "heuristic checks only (no LLM key)" : "LLM + heuristic checks"}</CardDescription></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div><span className="text-muted-foreground">Title:</span> {res.extracted.title || "—"}</div>
              <div><span className="text-muted-foreground">Meta description:</span> {res.extracted.metaDescription || <em>missing</em>}</div>
              <div><span className="text-muted-foreground">Canonical:</span> {res.extracted.canonical ?? <em>none</em>} · <span className="text-muted-foreground">JSON-LD blocks:</span> {res.extracted.structuredData.length} · <span className="text-muted-foreground">Words:</span> {res.extracted.text.split(/\s+/).length}</div>
              <div>
                <p className="text-muted-foreground mb-1">Headings</p>
                <ul className="text-xs space-y-0.5 max-h-48 overflow-auto">{res.extracted.headings.map((h, i) => <li key={i} style={{ paddingLeft: (h.level - 1) * 12 }}><span className="text-muted-foreground mr-1">H{h.level}</span>{h.text}</li>)}</ul>
              </div>
              <p className="text-muted-foreground">{res.analysis.summary}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Issues &amp; recommendations</CardTitle><CardDescription>{res.analysis.issues.length} issues{res.analysis.sensitive_domain !== "none" && <> · <Badge variant="secondary">{res.analysis.sensitive_domain} content — no regulated claims will be added</Badge></>}</CardDescription></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ul className="space-y-1.5">{res.analysis.issues.map((i, k) => <li key={k} className="flex gap-2"><Badge variant={sev[i.severity]} className="shrink-0 capitalize">{i.severity}</Badge><span><span className="text-muted-foreground">{i.type.replace(/_/g, " ")}:</span> {i.description}</span></li>)}</ul>
              {res.analysis.recommendations.length > 0 && <div><p className="font-medium mb-1">Recommendations</p><ul className="list-disc pl-5 space-y-0.5">{res.analysis.recommendations.map((r, k) => <li key={k}>{r}</li>)}</ul></div>}
              {res.analysis.unanswered_questions.length > 0 && <div><p className="font-medium mb-1">Relevant questions the page does not answer</p><ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">{res.analysis.unanswered_questions.map((r, k) => <li key={k}>{r}</li>)}</ul><p className="text-xs text-muted-foreground mt-1">These are not auto-answered; add verified source information before publishing.</p></div>}
            </CardContent>
          </Card>
        </div>
      )}

      {opt && (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-muted-foreground">Proposal generated {fmtDate(opt.createdAt)} · {opt.page?.url ?? url}. Generated content is a proposal for manual review, not published content.</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copy}>{copied ? <Check /> : <Copy />} Copy HTML</Button>
              <Button variant="outline" size="sm" onClick={download}><Download /> Download HTML</Button>
            </div>
          </div>
          <Tabs defaultValue="preview">
            <TabsList><TabsTrigger value="preview">Preview</TabsTrigger><TabsTrigger value="source">HTML source</TabsTrigger><TabsTrigger value="report">Report</TabsTrigger></TabsList>
            <TabsContent value="preview">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card><CardHeader><CardTitle>Original Content</CardTitle></CardHeader><CardContent><iframe title="original" sandbox="" className="w-full h-[640px] border border-border rounded-md bg-white" srcDoc={wrapDoc(opt.originalHtml, "original")} /></CardContent></Card>
                <Card><CardHeader><CardTitle>Optimized Content</CardTitle></CardHeader><CardContent><iframe title="optimized" sandbox="" className="w-full h-[640px] border border-border rounded-md bg-white" srcDoc={wrapDoc(opt.optimizedHtml, title)} /></CardContent></Card>
              </div>
            </TabsContent>
            <TabsContent value="source">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card><CardHeader><CardTitle>Original HTML</CardTitle></CardHeader><CardContent><pre className="text-xs whitespace-pre-wrap break-all max-h-[640px] overflow-auto font-mono">{opt.originalHtml}</pre></CardContent></Card>
                <Card><CardHeader><CardTitle>Optimized HTML</CardTitle></CardHeader><CardContent><pre className="text-xs whitespace-pre-wrap break-all max-h-[640px] overflow-auto font-mono">{opt.optimizedHtml}</pre></CardContent></Card>
              </div>
            </TabsContent>
            <TabsContent value="report">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle>Changes</CardTitle><CardDescription>{opt.summary}</CardDescription></CardHeader>
                  <CardContent className="text-sm space-y-3">
                    {changes?.structural_changes.length ? <div><p className="font-medium mb-1">Structural changes</p><ul className="list-disc pl-5 space-y-0.5">{changes.structural_changes.map((s, i) => <li key={i}>{s}</li>)}</ul></div> : null}
                    <div><p className="font-medium mb-1">Explanation of each change</p><ul className="space-y-2">{changes?.changes.map((c, i) => <li key={i} className="border-l-2 border-border pl-3"><span className="font-medium">{c.section}</span>: {c.change}<div className="text-muted-foreground text-xs">{c.reason}</div></li>)}</ul></div>
                    {recs?.preserved_facts_note && <p className="text-xs text-muted-foreground">{recs.preserved_facts_note}</p>}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Key recommendations</CardTitle></CardHeader>
                  <CardContent className="text-sm space-y-3">
                    <ul className="list-disc pl-5 space-y-0.5">{recs?.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul>
                    <ul className="space-y-1">{recs?.issues.map((i, k) => <li key={k} className="flex gap-2"><Badge variant={sev[i.severity]} className="shrink-0 capitalize">{i.severity}</Badge><span>{i.description}</span></li>)}</ul>
                    {recs?.structured_data_suggestion && <div><p className="font-medium mb-1">Structured data suggestion (verify before use)</p><pre className="text-xs whitespace-pre-wrap font-mono bg-muted/40 p-2 rounded">{recs.structured_data_suggestion}</pre></div>}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}

      <Card className="mt-6">
        <CardHeader><CardTitle>Optimization history</CardTitle><CardDescription>Analyzed pages and saved proposals</CardDescription></CardHeader>
        <CardContent>
          {!history.data?.length ? <p className="text-sm text-muted-foreground">No pages analyzed yet.</p> : (
            <ul className="divide-y divide-border text-sm">
              {history.data.map((p) => (
                <li key={p.id} className="py-2">
                  <div className="flex items-center justify-between gap-3">
                    <button className="underline truncate text-left" onClick={() => analyze(p.url)}>{p.url}</button>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">analyzed {fmtDate(p.lastAnalyzedAt)}</span>
                  </div>
                  {p.optimizations.length > 0 && (
                    <ul className="mt-1 pl-4 space-y-0.5 text-xs">
                      {p.optimizations.map((o) => <li key={o.id}><button className="hover:underline" onClick={() => loadOpt(o.id)}>{fmtDate(o.createdAt)} · {o.trigger} · {o.summary?.slice(0, 100) ?? "proposal"}</button></li>)}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
