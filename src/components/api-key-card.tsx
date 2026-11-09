"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useApi, post } from "@/components/ui-bits";

export function ApiKeyCard() {
  const { data, reload } = useApi<{ apiKey: string | null }>("/api/apikey");
  const [show, setShow] = useState(false);
  const key = data?.apiKey;
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return (
    <Card>
      <CardHeader>
        <CardTitle>API</CardTitle>
        <CardDescription>Your site calls these endpoints; the weekly agent keeps the answers fresh. Spec: <a className="underline" href="/v1/openapi.json">/v1/openapi.json</a> · <a className="underline" href="/docs">docs</a></CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center gap-2">
          <code className="rounded bg-muted px-2 py-1 text-xs break-all">{key ? (show ? key : key.slice(0, 8) + "…") : "no key yet"}</code>
          {key && <Button size="xs" variant="ghost" onClick={() => setShow(!show)}>{show ? "Hide" : "Show"}</Button>}
          <Button size="xs" variant="outline" onClick={async () => { await post("/api/apikey"); await reload(); }}>{key ? "Rotate" : "Generate"}</Button>
        </div>
        <pre className="text-xs bg-muted/40 rounded p-3 overflow-auto">{`curl ${base}/v1/visibility -H "X-API-Key: ${show && key ? key : "$GEO_API_KEY"}"
curl "${base}/v1/pages/optimized?url=https://example.com/page&wait=1" -H "X-API-Key: ${show && key ? key : "$GEO_API_KEY"}"`}</pre>
      </CardContent>
    </Card>
  );
}
