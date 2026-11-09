"use client";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorBox } from "@/components/ui-bits";

export type ProjectFormValue = {
  company: string;
  brand: string;
  website: string;
  aliases: string[];
  competitors: { name: string; domain?: string }[];
  prompts: string[];
};

export function ProjectForm({
  initial,
  onSubmit,
  submitLabel,
  showPrompts = true,
}: {
  initial?: Partial<ProjectFormValue>;
  onSubmit: (v: ProjectFormValue) => Promise<void>;
  submitLabel: string;
  showPrompts?: boolean;
}) {
  const [company, setCompany] = useState(initial?.company ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [website, setWebsite] = useState(initial?.website ?? "");
  const [aliases, setAliases] = useState((initial?.aliases ?? []).join(", "));
  const [competitors, setCompetitors] = useState<{ name: string; domain?: string }[]>(initial?.competitors?.length ? initial.competitors : [{ name: "", domain: "" }]);
  const [prompts, setPrompts] = useState((initial?.prompts ?? []).join("\n"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let site = website.trim();
      if (site && !/^https?:\/\//.test(site)) site = "https://" + site;
      await onSubmit({
        company: company.trim(),
        brand: brand.trim(),
        website: site,
        aliases: aliases.split(",").map((s) => s.trim()).filter(Boolean),
        competitors: competitors.filter((c) => c.name.trim()).map((c) => ({ name: c.name.trim(), domain: c.domain?.trim() || undefined })),
        prompts: prompts.split("\n").map((s) => s.trim()).filter(Boolean),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="company">Company name</Label>
          <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} required placeholder="Example Dental Clinic" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="brand">Brand name</Label>
          <Input id="brand" value={brand} onChange={(e) => setBrand(e.target.value)} required placeholder="Example Dental" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="website">Website URL</Label>
          <Input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} required placeholder="https://example.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="aliases">Brand aliases (comma separated, optional)</Label>
          <Input id="aliases" value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="Example Dental Clinic, ExDental" />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Competitors</Label>
        {competitors.map((c, i) => (
          <div key={i} className="flex gap-2">
            <Input value={c.name} onChange={(e) => setCompetitors(competitors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Competitor name" />
            <Input value={c.domain ?? ""} onChange={(e) => setCompetitors(competitors.map((x, j) => (j === i ? { ...x, domain: e.target.value } : x)))} placeholder="competitor.com (optional)" />
            <Button type="button" variant="ghost" size="icon" aria-label="Remove" onClick={() => setCompetitors(competitors.filter((_, j) => j !== i))}>
              <X />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setCompetitors([...competitors, { name: "", domain: "" }])}>
          <Plus /> Add competitor
        </Button>
      </div>

      {showPrompts && (
        <div className="space-y-1.5">
          <Label htmlFor="prompts">Target search prompts (one per line)</Label>
          <Textarea id="prompts" rows={5} value={prompts} onChange={(e) => setPrompts(e.target.value)} placeholder={"Best dental clinic in Gangnam\nRecommended dental clinics in Seoul\nWhere should I get dental implants?"} />
        </div>
      )}

      {error && <ErrorBox message={error} />}
      <Button type="submit" disabled={busy}>{busy ? "Saving…" : submitLabel}</Button>
    </form>
  );
}
