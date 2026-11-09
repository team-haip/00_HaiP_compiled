"use client";
import { Fragment, useState } from "react";
import { Play, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, Spinner, ErrorBox, Empty, Kpi, Notice, pct, fmtDate, useApi, post } from "@/components/ui-bits";
import { TrendChart, BarsChart } from "@/components/charts";
import type { RunMetrics } from "@/lib/metrics";

type Result = { id: string; provider: string; model: string; answer: string; status: string; error: string | null; targetMentioned: boolean; uncertain: boolean; mentionedBrands: string; targetPosition: number | null; timestamp: string; prompt: { text: string }; citations: { url: string; domain: string }[] };
type Data = { history: RunMetrics[]; latest: RunMetrics | null; results: Result[] };

export default function Visibility() {
  const [runId, setRunId] = useState<string | null>(null);
  const { data, error, loading, reload } = useApi<Data>(`/api/monitor/results${runId ? `?runId=${runId}` : ""}`);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setRunError(null);
    try {
      await post("/api/monitor/run");
      setRunId(null);
      await reload();
    } catch (e) {
      setRunError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const latest = data?.latest ?? null;
  const trend = (data?.history ?? []).map((h) => ({ label: new Date(h.startedAt).toLocaleDateString("en-GB", { month: "short", day: "numeric" }), mention: h.brandMentionRate, share: h.shareOfMentions }));

  return (
    <>
      <PageHeader title="AI Visibility" description="API-based AI Search Visibility — how often the brand appears in grounded answers from the OpenAI and Gemini APIs.">
        <Button onClick={run} disabled={running}>
          {running ? <Loader2 className="animate-spin" /> : <Play />} {running ? "Running…" : "Run Monitoring"}
        </Button>
      </PageHeader>
      {running && <Notice className="mb-4">Querying every active prompt on each configured provider. This can take a minute or two.</Notice>}
      {runError && <div className="mb-4"><ErrorBox message={runError} /></div>}
      {loading && !data ? <Spinner /> : error ? <ErrorBox message={error} /> : !latest ? (
        <Empty title="No monitoring runs yet" hint="Click Run Monitoring to query the configured AI search providers for every active prompt." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <Kpi label="Brand Mention Rate" value={pct(latest.brandMentionRate)} sub="answers mentioning brand ÷ evaluated answers" />
            <Kpi label="Brand Share of Mentions" value={pct(latest.shareOfMentions)} sub="brand mentions ÷ all tracked-brand mentions" />
            <Kpi label="Evaluated answers" value={String(latest.evaluated)} sub={`${latest.errors} errors · ${latest.uncertain} uncertain`} />
            <Kpi label="Run" value={fmtDate(latest.startedAt)} sub={latest.status} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2 mb-6">
            <Card>
              <CardHeader><CardTitle>Historical trend</CardTitle><CardDescription>{trend.length < 2 ? "Baseline — one run so far." : `${trend.length} runs`}</CardDescription></CardHeader>
              <CardContent><TrendChart data={trend} series={[{ key: "mention", label: "Mention rate" }, { key: "share", label: "Share of mentions" }]} /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Competitor comparison</CardTitle><CardDescription>Mention rate per brand (latest run)</CardDescription></CardHeader>
              <CardContent>
                <BarsChart data={[{ label: "Target", rate: latest.brandMentionRate ?? 0 }, ...latest.competitorRates.map((c) => ({ label: c.name, rate: c.rate }))]} series={[{ key: "rate", label: "Mention rate" }]} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>OpenAI vs Gemini</CardTitle><CardDescription>Mention rate by provider</CardDescription></CardHeader>
              <CardContent><BarsChart data={latest.byProvider.map((p) => ({ label: `${p.provider} (${p.evaluated})`, rate: p.mentionRate }))} series={[{ key: "rate", label: "Mention rate" }]} /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Runs</CardTitle><CardDescription>Select a run to inspect its prompt-level results</CardDescription></CardHeader>
              <CardContent className="max-h-60 overflow-auto">
                <ul className="text-sm divide-y divide-border">
                  {[...(data?.history ?? [])].reverse().map((h) => (
                    <li key={h.runId}>
                      <button className={`w-full text-left py-1.5 flex justify-between hover:underline ${h.runId === latest.runId ? "font-medium" : ""}`} onClick={() => setRunId(h.runId)}>
                        <span>{fmtDate(h.startedAt)}</span><span className="tabular-nums text-muted-foreground">{pct(h.brandMentionRate)} · {h.evaluated} answers</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Prompt-level results</CardTitle><CardDescription>Click a row to read the generated answer. Model and timestamp are stored per response.</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Prompt</TableHead><TableHead>Provider</TableHead><TableHead>Brand</TableHead><TableHead>Position</TableHead><TableHead>Brands mentioned</TableHead><TableHead>Citations</TableHead><TableHead>Time</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {data!.results.map((r) => (
                    <Fragment key={r.id}>
                      <TableRow key={r.id} className="cursor-pointer" onClick={() => setOpen(open === r.id ? null : r.id)}>
                        <TableCell className="max-w-xs truncate">{r.prompt.text}</TableCell>
                        <TableCell><Badge variant="outline">{r.provider}</Badge> <span className="text-xs text-muted-foreground">{r.model}</span></TableCell>
                        <TableCell>{r.status !== "ok" ? <Badge variant="destructive">error</Badge> : r.uncertain ? <Badge variant="secondary">uncertain</Badge> : r.targetMentioned ? <Badge>mentioned</Badge> : <Badge variant="outline">not mentioned</Badge>}</TableCell>
                        <TableCell className="tabular-nums">{r.targetPosition ?? "—"}</TableCell>
                        <TableCell className="text-xs">{JSON.parse(r.mentionedBrands || "[]").join(", ") || "—"}</TableCell>
                        <TableCell className="tabular-nums">{r.citations.length}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(r.timestamp)}</TableCell>
                      </TableRow>
                      {open === r.id && (
                        <TableRow key={r.id + "-detail"}>
                          <TableCell colSpan={7} className="bg-muted/30">
                            {r.status !== "ok" ? <ErrorBox message={r.error ?? "Unknown error"} /> : <pre className="whitespace-pre-wrap text-xs font-sans leading-relaxed max-h-80 overflow-auto">{r.answer}</pre>}
                            {r.citations.length > 0 && (
                              <ul className="mt-2 text-xs space-y-0.5">{r.citations.map((c, i) => <li key={i}><a className="underline" href={c.url} target="_blank" rel="noreferrer">{c.url}</a></li>)}</ul>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
