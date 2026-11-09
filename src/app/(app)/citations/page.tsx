"use client";
import { Fragment, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, Spinner, ErrorBox, Empty, Kpi, Notice, pct, fmtDate, useApi } from "@/components/ui-bits";
import { TrendChart } from "@/components/charts";
import type { RunMetrics } from "@/lib/metrics";

type Detail = { id: string; url: string; domain: string; title: string | null; result: { id: string; provider: string; model: string; timestamp: string; answer: string; prompt: { text: string } } };
type Data = { history: RunMetrics[]; latest: RunMetrics | null; previous: RunMetrics | null; details: Detail[]; answersWithoutCitations: number };

export default function Citations() {
  const { data, error, loading } = useApi<Data>("/api/citations");
  const [open, setOpen] = useState<string | null>(null);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} />;
  const latest = data?.latest ?? null;
  if (!latest) return <><PageHeader title="Citation Analytics" /><Empty title="No citation data yet" hint="Run monitoring first. Citations are read from the search providers' citation metadata only." /></>;
  const prevCount = new Map(data!.previous?.citations.topDomains.map((d) => [d.domain, d.count]) ?? []);
  const trend = data!.history.map((h) => ({ label: new Date(h.startedAt).toLocaleDateString("en-GB", { month: "short", day: "numeric" }), citation: h.citations.targetCitationRate }));
  const unavailable = latest.citations.total === 0;

  return (
    <>
      <PageHeader title="Citation Analytics" description="Which sources the grounded search APIs cited for your prompts. Only provider-returned citation metadata is counted." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Kpi label="Total citations" value={String(latest.citations.total)} sub={`latest run · ${fmtDate(latest.startedAt)}`} />
        <Kpi label="Unique domains" value={String(latest.citations.uniqueDomains)} />
        <Kpi label="Target domain citation rate" value={pct(latest.citations.targetCitationRate)} sub="answers citing your domain ÷ answers with citations" />
        <Kpi label="Answers without citations" value={String(data!.answersWithoutCitations)} sub="no citation metadata returned" />
      </div>
      {unavailable && <Notice className="mb-6">Citation metadata was unavailable for every answer in this run (demo mode, or the provider returned no grounding sources).</Notice>}

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader><CardTitle>Top cited domains</CardTitle><CardDescription>Ranked by citation count · change vs. previous run</CardDescription></CardHeader>
          <CardContent>
            {latest.citations.topDomains.length === 0 ? <p className="text-sm text-muted-foreground">Unavailable.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Domain</TableHead><TableHead className="text-right">Count</TableHead><TableHead className="text-right">Share</TableHead><TableHead className="text-right">Δ</TableHead></TableRow></TableHeader>
                <TableBody>
                  {latest.citations.topDomains.map((d) => {
                    const prev = prevCount.get(d.domain);
                    const delta = data!.previous ? d.count - (prev ?? 0) : null;
                    return (
                      <TableRow key={d.domain}>
                        <TableCell className="font-mono text-xs">{d.domain}</TableCell>
                        <TableCell className="text-right tabular-nums">{d.count}</TableCell>
                        <TableCell className="text-right tabular-nums">{pct(d.share, 1)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{delta === null ? "—" : delta > 0 ? `+${delta}` : delta === 0 ? "0" : delta}{delta !== null && prev === undefined && <Badge variant="secondary" className="ml-1">new</Badge>}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Citation trend</CardTitle><CardDescription>{trend.length < 2 ? "Baseline — trend appears after the next run." : "Target domain citation rate per run"}</CardDescription></CardHeader>
          <CardContent><TrendChart data={trend} series={[{ key: "citation", label: "Target citation rate" }]} /></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Citation details</CardTitle><CardDescription>Source URL, prompt, provider and timestamp. Click a row for the related answer.</CardDescription></CardHeader>
        <CardContent>
          {data!.details.length === 0 ? <p className="text-sm text-muted-foreground">Unavailable.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Source</TableHead><TableHead>Prompt</TableHead><TableHead>Provider</TableHead><TableHead>Time</TableHead></TableRow></TableHeader>
              <TableBody>
                {data!.details.map((c) => (
                  <Fragment key={c.id}>
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => setOpen(open === c.id ? null : c.id)}>
                      <TableCell className="max-w-sm"><a href={c.url} target="_blank" rel="noreferrer" className="underline text-xs break-all" onClick={(e) => e.stopPropagation()}>{c.url}</a>{c.title && <div className="text-xs text-muted-foreground truncate">{c.title}</div>}</TableCell>
                      <TableCell className="max-w-xs truncate">{c.result.prompt.text}</TableCell>
                      <TableCell><Badge variant="outline">{c.result.provider}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(c.result.timestamp)}</TableCell>
                    </TableRow>
                    {open === c.id && <TableRow key={c.id + "-a"}><TableCell colSpan={4} className="bg-muted/30"><pre className="whitespace-pre-wrap text-xs font-sans leading-relaxed max-h-80 overflow-auto">{c.result.answer}</pre></TableCell></TableRow>}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
