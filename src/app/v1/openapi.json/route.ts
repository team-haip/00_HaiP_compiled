import { NextResponse } from "next/server";

const spec = {
  openapi: "3.0.3",
  info: {
    title: "Self-Maintaining GEO API",
    version: "1.0.0",
    description:
      "An API whose answers maintain themselves. Register a brand once; a weekly agent monitors API-based AI search visibility (OpenAI + Gemini grounded search), analyzes citations, and regenerates optimized page content. Figures are API-based AI Search Visibility, not consumer ChatGPT/Gemini impressions. Generated HTML is a proposal for review; nothing is published automatically.",
  },
  servers: [{ url: "/v1" }],
  components: { securitySchemes: { ApiKey: { type: "apiKey", in: "header", name: "X-API-Key" } } },
  security: [{ ApiKey: [] }],
  paths: {
    "/projects": {
      post: {
        summary: "Register a project (returns the API key once)",
        security: [],
        requestBody: { required: true, content: { "application/json": { example: { company: "Example Dental Clinic", brand: "Example Dental", website: "https://example.com", competitors: [{ name: "Competitor A", domain: "competitor-a.com" }], prompts: ["Best dental clinic in Gangnam"] } } } },
        responses: { "201": { description: "Created", content: { "application/json": { example: { id: "…", apiKey: "geo_…" } } } } },
      },
      get: { summary: "Project details", responses: { "200": { description: "OK" } } },
    },
    "/visibility": {
      get: {
        summary: "Latest visibility metrics, changes since previous run, and opportunities",
        responses: { "200": { description: "OK", content: { "application/json": { example: { label: "API-based AI Search Visibility", baseline: false, metrics: { brandMentionRate: 0.33, shareOfMentions: 0.2, targetCitationRate: 0.17 }, changesSincePrevious: [{ metric: "brandMentionRate", previous: 0.5, current: 0.33, delta: -0.17, meaningful: true, direction: "down" }] } } } } },
      },
    },
    "/pages/optimized": {
      get: {
        summary: "Latest optimized HTML for a page (regenerated when older than 7 days or by the weekly agent)",
        parameters: [
          { name: "url", in: "query", required: true, schema: { type: "string", format: "uri" } },
          { name: "format", in: "query", schema: { type: "string", enum: ["html", "json"], default: "html" } },
          { name: "wait", in: "query", schema: { type: "string", enum: ["1"] }, description: "Block until generation finishes instead of returning 202" },
        ],
        responses: {
          "200": { description: "Optimized HTML fragment. Headers: X-GEO-Generated-At, X-GEO-Stale, X-GEO-Optimization-Id" },
          "202": { description: "Generation started; retry after 60s or call with wait=1" },
        },
      },
    },
  },
};

export function GET() {
  return NextResponse.json(spec);
}
