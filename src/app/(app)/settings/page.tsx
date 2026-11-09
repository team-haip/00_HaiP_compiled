"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ProjectForm } from "@/components/project-form";
import { PageHeader, Spinner, ErrorBox, Notice, useApi, post } from "@/components/ui-bits";

type Project = { id: string; companyName: string; brandName: string; website: string; domain: string; aliases: string; competitors: { name: string; domain: string | null }[]; prompts: { id: string; text: string; active: boolean }[]; schedule: { cronExpression: string; timezone: string; enabled: boolean } | null };

export default function Settings() {
  const { data, error, loading, reload } = useApi<Project>("/api/projects");
  const [newPrompt, setNewPrompt] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cron, setCron] = useState<string | null>(null);
  const [tz, setTz] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setErr(null); setMsg(null);
    try { await fn(); setMsg(ok); await reload(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };
  const complete = data.prompts.length > 0 && data.competitors.length > 0;

  return (
    <>
      <PageHeader title="Settings" description="Project information, prompts and the weekly schedule." />
      <div className="mb-4 flex items-center gap-2 text-sm">
        Onboarding status: {complete ? <Badge>complete</Badge> : <Badge variant="secondary">incomplete — add {data.prompts.length === 0 ? "prompts" : "competitors"}</Badge>}
      </div>
      {msg && <Notice className="mb-4">{msg}</Notice>}
      {err && <div className="mb-4"><ErrorBox message={err} /></div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Project</CardTitle><CardDescription>Domain is normalized to <code>{data.domain}</code>.</CardDescription></CardHeader>
          <CardContent>
            <ProjectForm
              showPrompts={false}
              submitLabel="Save project"
              initial={{ company: data.companyName, brand: data.brandName, website: data.website, aliases: JSON.parse(data.aliases || "[]"), competitors: data.competitors.map((c) => ({ name: c.name, domain: c.domain ?? "" })) }}
              onSubmit={(v) => act(() => post("/api/projects", v, "PUT"), "Project saved.")}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Search prompts</CardTitle><CardDescription>Inactive prompts are skipped by monitoring.</CardDescription></CardHeader>
            <CardContent>
              <ul className="divide-y divide-border text-sm mb-3">
                {data.prompts.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-1.5">
                    <span className={p.active ? "" : "text-muted-foreground line-through"}>{p.text}</span>
                    <span className="flex gap-1 shrink-0">
                      <Button size="xs" variant="ghost" onClick={() => act(() => post("/api/prompts", { id: p.id, active: !p.active }, "PATCH"), "Prompt updated.")}>{p.active ? "Deactivate" : "Activate"}</Button>
                      <Button size="icon-xs" variant="ghost" aria-label="Delete" onClick={() => act(() => post("/api/prompts", { id: p.id }, "DELETE"), "Prompt deleted.")}><Trash2 /></Button>
                    </span>
                  </li>
                ))}
              </ul>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); act(() => post("/api/prompts", { text: newPrompt }), "Prompt added.").then(() => setNewPrompt("")); }}>
                <Input value={newPrompt} onChange={(e) => setNewPrompt(e.target.value)} placeholder="New search prompt" required minLength={3} />
                <Button type="submit" variant="outline"><Plus /> Add</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Weekly schedule</CardTitle><CardDescription>Stored in the database. Default: every Monday 09:00 Asia/Seoul. An external scheduler must call <code>/api/cron/weekly</code>.</CardDescription></CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act(() => post("/api/schedule", { cronExpression: cron ?? data.schedule?.cronExpression ?? "0 9 * * 1", timezone: tz ?? data.schedule?.timezone ?? "Asia/Seoul", enabled: enabled ?? data.schedule?.enabled ?? true }, "PUT"), "Schedule saved."); }}>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label htmlFor="cron">Cron expression</Label><Input id="cron" value={cron ?? data.schedule?.cronExpression ?? "0 9 * * 1"} onChange={(e) => setCron(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label htmlFor="tz">Timezone</Label><Input id="tz" value={tz ?? data.schedule?.timezone ?? "Asia/Seoul"} onChange={(e) => setTz(e.target.value)} /></div>
                </div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled ?? data.schedule?.enabled ?? true} onChange={(e) => setEnabled(e.target.checked)} /> Enabled</label>
                <Button type="submit" variant="outline">Save schedule</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
