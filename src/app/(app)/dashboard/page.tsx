"use client";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Spinner, ErrorBox, Empty, Kpi, Notice, pct, fmtDate, useApi } from "@/components/ui-bits";
import { TrendChart, BarsChart } from "@/components/charts";
import type { RunMetrics } from "@/lib/metrics";

type Data = {
  project: { brand: string; domain: string; prompts: number; competitors: string[] };
  history: RunMetrics[];
  latest: RunMetrics | null;
  pages: number;
  activity: { at: string; kind: string; text: string; status: "ok" | "error" }[];
  providers: { openai: boolean; gemini: boolean; demo: boolean };
};

export default function Dashboard() {
  const { data, error, loading } = useApi<Data>("/api/dashboard");
  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;
  const { latest, history } = data;
  const trend = history.map((h) => ({ label: new Date(h.startedAt).toLocaleDateString("en-GB", { month: "short", day: "numeric" }), mention: h.brandMentionRate, share: h.shareOfMentions, citation: h.citations.targetCitationRate }));
  const providers = latest?.byProvider.map((p) => ({ label: p.provider, mention: p.mentionRate, citation: p.citationRate })) ?? [];
  const competitors = latest ? [{ label: data.project.brand, rate: latest.brandMentionRate ?? 0 }, ...latest.competitorRates.map((c) => ({ label: c.name, rate: c.rate }))] : [];
  const domains = latest?.citations.topDomains.slice(0, 8).map((d) => ({ label: d.domain, count: d.count })) ?? [];

  return (
    <>
      <PageHeader title="Overview" description={`${data.project.brand} · ${data.project.domain} · API-based AI Search Visibility`}>
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/visibility" />}>Run monitoring</Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Kpi label="AI Brand Mention Rate" value={pct(latest?.brandMentionRate)} sub={latest ? `${latest.evaluated} answers evaluated` : "No monitoring run yet"} />
        <Kpi label="Citation Rate" value={pct(latest?.citations.targetCitationRate)} sub={latest ? `${latest.citations.total} citations collected` : "No monitoring run yet"} />
        <Kpi label="Tracked Prompts" value={String(data.project.prompts)} sub="active prompts" />
        <Kpi label="Monitored Pages" value={String(data.pages)} sub="registered for optimization" />
      </div>

      {!latest ? (
        <Empty title="No monitoring data yet" hint="Run your first monitoring pass to establish a baseline." action={<Button nativeButton={false} render={<Link href="/visibility" />}>Go to AI Visibility</Button>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Brand visibility over time</CardTitle>
              <CardDescription>{history.length < 2 ? "Baseline run — trends appear after the next monitoring run." : `${history.length} runs`}</CardDescription>
            </CardHeader>
            <CardContent>
              <TrendChart data={trend} series={[{ key: "mention", label: "Mention rate" }, { key: "share", label: "Share of mentions" }, { key: "citation", label: "Citation rate" }]} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>OpenAI vs Gemini</CardTitle>
              <CardDescription>Latest run · mention rate and target citation rate by provider</CardDescription>
            </CardHeader>
            <CardContent>
              <BarsChart data={providers} series={[{ key: "mention", label: "Mention rate" }, { key: "citation", label: "Citation rate" }]} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Competitor comparison</CardTitle>
              <CardDescription>Mention rate per brand · share of mentions for {data.project.brand}: {pct(latest.shareOfMentions)}</CardDescription>
            </CardHeader>
            <CardContent>
              {competitors.length > 1 ? <BarsChart data={competitors} series={[{ key: "rate", label: "Mention rate" }]} /> : <Notice>No competitors registered. Add them in Settings.</Notice>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Citation domain distribution</CardTitle>
              <CardDescription>Top cited domains in the latest run</CardDescription>
            </CardHeader>
            <CardContent>
              {domains.length ? <BarsChart data={domains} series={[{ key: "count", label: "Citations" }]} percent={false} /> : <Notice>No citation metadata was returned in the latest run.</Notice>}
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Agent activity</CardTitle>
          <CardDescription>Recent monitoring, optimization and weekly job events</CardDescription>
        </CardHeader>
        <CardContent>
          {data.activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.activity.map((a, i) => (
                <li key={i} className="flex items-center justify-between py-2 text-sm gap-4">
                  <span className="flex items-center gap-2 min-w-0">
                    <Badge variant={a.status === "error" ? "destructive" : "secondary"} className="capitalize shrink-0">{a.kind}</Badge>
                    <span className="truncate">{a.text}</span>
                  </span>
                  <span className="text-muted-foreground tabular-nums shrink-0">{fmtDate(a.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
