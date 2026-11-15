export const metadata = { title: "Self-Maintaining GEO API — Docs" };

const Code = ({ children }: { children: string }) => <pre className="text-xs bg-muted/40 border border-border rounded-md p-3 overflow-auto">{children}</pre>;

export default function Docs() {
  return (
    <article className="prose-sm max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Self-Maintaining GEO API</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Register a brand once. A weekly agent monitors API-based AI search visibility (OpenAI + Gemini grounded search), analyzes citations, and regenerates optimized page content. Your site just calls the API; the answers maintain themselves.
        </p>
      </div>
      <section className="space-y-2">
        <h2 className="font-medium">1. Register</h2>
        <Code>{`curl -X POST $BASE/v1/projects -H "content-type: application/json" -d '{
  "company": "Example Dental Clinic", "brand": "Example Dental", "website": "https://example.com",
  "competitors": [{"name": "Competitor A", "domain": "competitor-a.com"}],
  "prompts": ["Best dental clinic in Gangnam", "Where should I get dental implants?"]
}'
# → { "apiKey": "geo_…" }  (shown once)`}</Code>
      </section>
      <section className="space-y-2">
        <h2 className="font-medium">2. Read visibility</h2>
        <Code>{`curl $BASE/v1/visibility -H "X-API-Key: geo_…"
# → brandMentionRate, shareOfMentions, targetCitationRate, byProvider, topCitedDomains,
#   changesSincePrevious (flagged "meaningful" only above the noise threshold), opportunities`}</Code>
      </section>
      <section className="space-y-2">
        <h2 className="font-medium">3. Embed self-maintaining content</h2>
        <Code>{`curl "$BASE/v1/pages/optimized?url=https://example.com/implants&wait=1" -H "X-API-Key: geo_…"
# → text/html fragment. Headers: X-GEO-Generated-At, X-GEO-Stale, X-GEO-Optimization-Id
# Without wait=1: 202 { status: "generating" } on first call; cached afterwards.
# &format=json adds the change log and recommendations for review.`}</Code>
        <p className="text-sm text-muted-foreground">
          Server-side example (any CMS): fetch the fragment at render time and insert it into the page. The weekly agent re-runs monitoring and regenerates the fragment, so the content tracks how AI search answers shift without manual work. Generated HTML is a proposal; review it before publishing on regulated topics.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="font-medium">Schedule</h2>
        <p className="text-sm text-muted-foreground">Default <code>0 9 * * 1</code> Asia/Seoul, stored per project. An external scheduler calls <code>POST /api/cron/weekly</code> with <code>Authorization: Bearer CRON_SECRET</code>; runs are idempotent per ISO week.</p>
      </section>
      <p className="text-xs text-muted-foreground">Figures are API-based AI Search Visibility, not consumer ChatGPT/Gemini impressions. OpenAPI: <a className="underline" href="/v1/openapi.json">/v1/openapi.json</a></p>
    </article>
  );
}
