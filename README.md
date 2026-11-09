# Self-Maintaining GEO Agent (MVP)

A GEO (Generative Engine Optimization) maintenance agent that monitors how a brand appears in AI search (OpenAI and Gemini APIs), analyzes citation sources, and generates improved HTML for existing pages.

Workflow: **Monitor → Analyze → Optimize → Deploy (reviewable HTML artifact) → Verify → Repeat**

> All visibility figures are **API-based AI Search Visibility**. They are not impression data from the consumer ChatGPT or Gemini apps. Generated HTML is a proposal for review; nothing is published to the customer's site automatically.

## Setup

```bash
npm install
cp .env.example .env        # add your keys
npx prisma migrate dev      # creates the SQLite dev.db
npm run dev                 # http://localhost:3000
```

Run `npm run build` to verify the production build.

## API keys (`.env`)

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Responses API with the `web_search` tool for monitoring; structured outputs for brand extraction, content analysis and optimization |
| `GEMINI_API_KEY` | `@google/genai` `generateContent` with `googleSearch` grounding. If no OpenAI key is set, Gemini also handles the LLM tasks |
| `OPENAI_MODEL` / `GEMINI_MODEL` | Defaults `gpt-6-astra` / `gemini-3.8-flash` (per the official docs at the time of writing). Override if your account lacks them |
| `CRON_SECRET` | Bearer token protecting `POST /api/cron/weekly` |
| `DEMO_MODE=1` | Force demo mode |

With neither key configured the app runs in **demo mode** automatically: monitoring stores fixed answers labeled `[DEMO MODE]` (no citations, model=`demo`), content analysis runs heuristic checks only, and optimization generation is disabled. A banner at the top of every page says so. Add keys and restart to switch to real API calls.

## Pages

| Route | Content |
|---|---|
| `/onboarding` | Register company, brand, website, competitors and prompts → redirects to `/dashboard` |
| `/dashboard` | KPIs (mention rate, citation rate, prompt count, page count), trend / provider / competitor / citation-domain charts, activity log |
| `/visibility` | Run Monitoring. Mention Rate (answers mentioning the brand ÷ evaluated answers) vs. Share of Mentions (brand mentions ÷ all tracked-brand mentions), prompt-level results with full answers |
| `/citations` | Top cited domains (count, share, delta vs. previous run), citation-rate trend, citation details (URL, prompt, provider, timestamp, answer) |
| `/optimization` | URL → Analyze Content → Generate Optimization → original/optimized split preview, source, report, copy / download, history |
| `/agents` | Run Agents Now, run history with steps, errors and the weekly summary |
| `/settings` | Edit project, add / remove / deactivate prompts, weekly schedule (stored in the database) |

## API

```
GET/POST/PUT /api/projects      GET /api/projects/:id
POST/PATCH/DELETE /api/prompts
POST /api/monitor/run           GET /api/monitor/results[?runId=]
GET  /api/citations
POST /api/content/analyze       POST /api/content/optimize       GET /api/content/history[?id=]
POST /api/agents/run            GET /api/agents/history
POST /api/cron/weekly           (Authorization: Bearer $CRON_SECRET)
PUT  /api/schedule              GET /api/dashboard
```

## Weekly automation

- The default schedule `0 9 * * 1` Asia/Seoul is stored in the `Schedule` table. **The app does not run a timer itself.** An external scheduler must call the endpoint for the weekly job to actually run.
- Locally, use the **Run Agents Now** button on Agent Runs, or:
  ```bash
  curl -X POST http://localhost:3000/api/cron/weekly -H "Authorization: Bearer $CRON_SECRET"
  ```
- External scheduler examples: crontab `0 9 * * 1 curl -X POST https://<host>/api/cron/weekly -H "Authorization: Bearer <secret>"`, Vercel Cron (`crons` in `vercel.json`, pass CRON_SECRET in the request header), or a GitHub Actions `schedule`.
- Idempotency: cron-triggered runs execute at most once per project per ISO week (`periodKey`, e.g. `2026-W46`); repeated calls return `duplicate: true`. Manual runs are unlimited. Concurrent runs for the same project are rejected.
- Without a previous successful run the report is a baseline. Metric differences below 10 percentage points are shown as "within noise" and never reported as deterioration.

## Implementation notes

- Brand mention detection: LLM structured extraction (using aliases and domains) cross-checked against deterministic string matching. Disagreement or low confidence marks the result `uncertain`.
- Citations: only OpenAI `url_citation` annotations and Gemini `groundingMetadata.groundingChunks[].web` are counted. URLs that merely appear in answer text are not citations. Gemini's vertexaisearch redirect URLs are resolved to the real URL with a HEAD request.
- Page fetching: public http/https only, private IPs blocked after DNS resolution, 15-second timeout, 2 MB limit, 403/429 reported as "blocked". Crawled content and AI answers are wrapped in `<<<UNTRUSTED>>>` markers so they are never treated as instructions.
- Optimization prompt rules: preserve original facts; never invent numbers, prices or testimonials; add an FAQ only when at least two Q/A pairs are supported by the source; no regulated claims for medical, financial or legal content; no promises of higher rankings.
- Structured server logs: one JSON line per event (`event`, `ts`, …).

## Verification status (2026-11-09)

- `npm install`, `npx prisma migrate dev`, `npm run lint`, `npm run build`, `npm run dev` pass.
- With real keys (`gpt-6-astra`, `gemini-3.8-flash`): monitoring 3 prompts × 2 providers, 6/6 answers, 22 citations (Gemini redirects resolved to real domains), analysis of the Wikipedia "Dental implant" page (flagged medical) and optimized HTML generation, and a full weekly agent run, all verified locally against `prisma/dev.db`.
- Demo runs recorded before keys were added are excluded from trends once real keys are configured (`RunMetrics.demo`).
- Original HTML is capped at 200k characters and optimization input at 60k. Long pages such as Wikipedia articles are rewritten only up to that point; the report's preserved-facts note says so.

## Known limitations

- Single project (the first project is used). No multi-project support or authentication.
- Duplicate-run protection is an in-process lock plus the AgentRun `running` status. Multi-instance deployments need a database lock.
- The weekly agent's Optimize step re-analyzes and regenerates at most 3 registered pages per run (cost cap).
- Retries are fixed at 2 with simple backoff.
- Citation change comparison covers the top 15 domains.
