"use client";
import { useState } from "react";
import { Bot, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Spinner, ErrorBox, Notice, pct, fmtDate, useApi, post } from "@/components/ui-bits";
import type { WeeklySummary } from "@/lib/agent";

type Run = { id: string; status: string; trigger: string; periodKey: string | null; executionLogs: string; summary: string | null; error: string | null; startedAt: string; completedAt: string | null };
type Step = { step: string; status: string; startedAt: string; endedAt?: string; error?: string; detail?: unknown };
type Data = { runs: Run[]; schedule: { cronExpression: string; timezone: string; enabled: boolean; lastRunAt: string | null } | null; providers: { demo: boolean } };

const statusVariant = (s: string) => (s === "failed" ? "destructive" : s === "running" ? "secondary" : "default");

export default function Agents() {
  const { data, error, loading, reload } = useApi<Data>("/api/agents/history");
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const run = async () => {
    setRunning(true); setRunError(null);
    try { await post("/api/agents/run"); await reload(); }
    catch (e) { setRunError(e instanceof Error ? e.message : String(e)); }
    finally { setRunning(false); }
  };

  return (
    <>
      <PageHeader title="Agent Runs" description="Weekly workflow: Monitor → Analyze → Detect → Recommend → Optimize → Report.">
        <Button onClick={run} disabled={running}>{running ? <Loader2 className="animate-spin" /> : <Bot />} {running ? "Running…" : "Run Agents Now"}</Button>
      </PageHeader>
      {data?.schedule && (
        <Notice className="mb-4">
          Schedule saved in the database: <code>{data.schedule.cronExpression}</code> ({data.schedule.timezone}), {data.schedule.enabled ? "enabled" : "disabled"}. Last run {fmtDate(data.schedule.lastRunAt)}.
          {" "}This app does not run the job by itself — an external scheduler must call <code>POST /api/cron/weekly</code> with the cron secret (see README).
        </Notice>
      )}
      {running && <Notice className="mb-4">Executing the full workflow. Monitoring every prompt can take a few minutes.</Notice>}
      {runError && <div className="mb-4"><ErrorBox message={runError} /></div>}
      {loading && !data ? <Spinner /> : error ? <ErrorBox message={error} /> : (
        <Card>
          <CardHeader><CardTitle>Run history</CardTitle><CardDescription>Click a run to see steps, errors and the weekly summary.</CardDescription></CardHeader>
          <CardContent>
            {!data?.runs.length ? <p className="text-sm text-muted-foreground">No agent runs yet.</p> : (
              <ul className="divide-y divide-border text-sm">
                {data.runs.map((r) => {
                  const steps = JSON.parse(r.executionLogs || "[]") as Step[];
                  const summary = r.summary ? (JSON.parse(r.summary) as WeeklySummary) : null;
                  return (
                    <li key={r.id} className="py-3">
                      <button className="w-full flex items-center justify-between gap-3 text-left" onClick={() => setOpen(open === r.id ? null : r.id)}>
                        <span className="flex items-center gap-2"><Badge variant={statusVariant(r.status)}>{r.status}</Badge><Badge variant="outline">{r.trigger}</Badge>{r.periodKey && <span className="text-xs text-muted-foreground">{r.periodKey}</span>}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">started {fmtDate(r.startedAt)} · completed {fmtDate(r.completedAt)}</span>
                      </button>
                      {r.error && <div className="mt-2"><ErrorBox message={r.error} /></div>}
                      {open === r.id && (
                        <div className="mt-3 grid gap-4 lg:grid-cols-2">
                          <div>
                            <p className="font-medium mb-1">Steps</p>
                            <ol className="space-y-1">
                              {steps.map((s, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <Badge variant={s.status === "failed" ? "destructive" : s.status === "skipped" ? "secondary" : "outline"} className="shrink-0 capitalize">{s.step}</Badge>
                                  <span className="text-xs text-muted-foreground">{s.status}{s.endedAt && ` · ${Math.round((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 1000)}s`}{s.error && ` · ${s.error}`}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                          <div className="space-y-2">
                            <p className="font-medium">Weekly summary</p>
                            {!summary ? <p className="text-muted-foreground">No summary.</p> : (
                              <>
                                {summary.demoMode && <Badge variant="secondary">demo mode data</Badge>}
                                {summary.baseline ? <p className="text-muted-foreground">Baseline report — no previous successful run to compare against.</p> : (
                                  <ul className="text-xs space-y-0.5">{summary.changes.map((c) => <li key={c.metric}>{c.metric}: {pct(c.previous)} → {pct(c.current)} ({c.direction}{c.meaningful ? ", meaningful" : ", within noise"})</li>)}</ul>
                                )}
                                {summary.monitoring && <p className="text-xs">Monitoring: {summary.monitoring.evaluated} answers, {summary.monitoring.errors} errors · mention {pct(summary.monitoring.brandMentionRate)} · share {pct(summary.monitoring.shareOfMentions)} · citation {pct(summary.monitoring.targetCitationRate)}</p>}
                                {(summary.citationChanges.newDomains.length > 0 || summary.citationChanges.lostDomains.length > 0) && <p className="text-xs">New cited domains: {summary.citationChanges.newDomains.join(", ") || "—"} · No longer cited: {summary.citationChanges.lostDomains.join(", ") || "—"}</p>}
                                {summary.opportunities.length > 0 && <div><p className="text-xs font-medium">Optimization opportunities</p><ul className="list-disc pl-4 text-xs space-y-0.5">{summary.opportunities.map((o, i) => <li key={i}>{o}</li>)}</ul></div>}
                                {summary.proposals.length > 0 && <div><p className="text-xs font-medium">Content proposals</p><ul className="list-disc pl-4 text-xs">{summary.proposals.map((p, i) => <li key={i}>{p.url} {p.optimizationId ? "— proposal saved (see Content Optimization)" : `— ${p.error}`}</li>)}</ul></div>}
                                <p className="text-xs text-muted-foreground">Status: {summary.status}</p>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
