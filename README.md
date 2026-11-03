# FINN — Your portfolio, in focus

[GitHub repository](https://github.com/hsevras/finn-investor) · [Private live prototype](https://finn-investor-sarvesh.epicdulse16.chatgpt.site)

A mobile-first investment briefing and primary-source research workspace, built for the ENAM AI Engineer Build Challenge. The emphasis is attention management: review the few changes that deserve a closer look, then go directly to the company’s own evidence.

**Working without API keys:** an 18-company watchlist, configurable filing/price/volume alerts, a server-backed inbox and reading list, real dated market and filing caches, and research with original PDF page links. Optional Groq synthesis adds concise, cited answers to the same evidence engine.

## Try the product

1. Open the briefing. Change **Last 24 hours** to **Last 7 days** to explore more events.
2. Open **Your rules**. Change the price or volume threshold and save; the briefing recalculates.
3. Bookmark a signal, change the time window, then open **Saved for later**. The saved record persists independently of the digest.
4. Open a filing and follow its original NSE source. Readable PDFs produce page-linked excerpts; scanned or blocked PDFs show an explicit gap.
5. Open Research. Try **INFY**, then **KPITTECH**, **PERSISTENT**, or **TRENT** (the last three are outside the starting portfolio). Ask “Is profit turning into cash?” or “What has management guided?”
6. Enter any other NSE ticker. The server discovers annual reports and call transcripts from NSE and Screener; it does not require a company-specific research template. Access and extraction depend on the source.

There are **no synthetic prices or invented financial statements** in the delivered seed. The checked-in snapshot was collected on 3 November 2026. It contains real histories for 22 tickers (18 in the starting portfolio, plus four research candidates) and 298 portfolio/candidate disclosures. Every price series retains its own collection time; filings retain the exchange ID and original publication time. Treat this as a dated cache until refreshed.

## Stack and local setup

- Node **22.13+**, pnpm **11.25+**, Git.
- React 19 + TypeScript, Vinext/Vite, Cloudflare Worker route handlers.
- Cloudflare D1 / SQLite persistence; Drizzle schema and checked-in SQL migrations.
- `unpdf` for page-preserving PDF text extraction; no Python service required.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm db:local
pnpm dev
```

Open the localhost URL printed by the dev command, normally `http://localhost:5173`. The local migration command creates the SQLite-backed D1 database under `.wrangler/state` and tracks applied migrations. No cloud account or paid model key is required for local use. Clean clones default to the portable development profile.

For a production-like local run:

```bash
pnpm build
pnpm start
```

Use the URL printed by Wrangler. Run `pnpm db:local` first. Do not commit `.wrangler`, `.dev.vars`, `.env`, generated builds or credentials.

### Optional model

Copy `.dev.vars.example` to `.dev.vars` and set your own `GROQ_API_KEY` to enable the Groq adapter. The baseline works with the value absent. Restart the development process after changing secrets. Model name: `llama-3.3-70b-versatile`; provider availability and free-tier limits can change.

Only the retrieved primary passages and the research question go to the optional provider. The prompt disallows outside company knowledge and instructions embedded in documents. Returned citation IDs are checked against the retrieval set. This is a citation integrity check, **not proof that every model assertion is entailed**; the original evidence remains visible.

### Refresh the bundled source cache

```bash
pnpm collect
# Refresh only the four research caches:
pnpm collect -- --research-only
# Research a new NSE company without changing the portfolio:
pnpm collect -- --research-only COFORGE
```

The collector uses the same discovery and extraction code as the server and writes its actual errors. Review them before replacing a good cache. Collection may take a few minutes because reports are large. Do not run multiple collectors concurrently.

## Verification

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm test:api
```

`test:api` runs the actual compiled Worker in an isolated Miniflare runtime with a fresh, migrated test database. It tests the API without depending on the development preview’s network bridge. To target a running app instead, set `FINN_BASE_URL` to its URL and run `node tests/api-smoke.mjs`. The script uses a separate device session and restores the original settings; run it only against a development/test instance.

See [docs/TEST_REPORT.md](docs/TEST_REPORT.md) for actual checks, source-specific limitations and browser QA. No blanket claim of production readiness is made.

## Repository structure

```text
app/
  page.tsx                  Responsive briefing, research, portfolio and saved views
  globals.css               Visual system and responsive layouts
  layout.tsx                Metadata and document shell
  api/finn/[...path]/route.ts  Validated API and identity boundary
lib/finn/
  types.ts                  Domain contracts
  universe.ts               Starting portfolio, category labels and defaults
  engine.ts                 Triage, EOD calculations, chunking and evidence ranking
  providers.ts              Bounded Yahoo/NSE/Screener/PDF adapters
  storage.ts                Owner-scoped settings, cache, inbox and read receipts
  service.ts                Briefing, refresh, research, saved items and scheduled monitor
worker/index.ts             HTTP entrypoint and scheduled monitoring handler
db/schema.ts                Drizzle schema
drizzle/                    SQL migrations and schema metadata
data/
  snapshot.json             Real, timestamped EOD/filing fallback
  research-*.json            Extracted primary-text caches and document provenance
scripts/
  collect-sources.ts         Reproducible real-source collector
  migrate-local.mjs          Cross-platform local migration runner
  standalone-config.mjs      Cloudflare deployment config generator
tests/
  engine.test.ts             Calculation, classification, discovery and evidence tests
  api-smoke.mjs              Compiled-Worker/database integration checks
docs/
  ARCHITECTURE.md
  DEPLOYMENT.md
  TEST_REPORT.md
  COVERING_NOTE.md
  AI_BUILD_HISTORY.md
  SUBMISSION.md
```

## Important scope decisions

- Push means proactive **in-app** briefing and persisted alert inbox. There is no OS push, email or SMS delivery. While open, the app polls NSE at the selected interval, with a shared one-minute minimum cache. EOD prices refresh on request. Closed-app checks require the supplied scheduled Worker deployment.
- NSE, Yahoo and Screener endpoints are public-site integrations, not contracted APIs. They can throttle or block a server. Failures retain dated data and expose status. The development sandbox could collect public sources from Node but sometimes rejected requests from the hosted preview runtime; those two environments must not be confused.
- Screener is a link index only. Its summaries, ratios, broker content and news do not enter pull analysis.
- Reports are limited to 25 MB and the first 85 physical PDF pages; transcripts to 45 pages. Coverage is visible. Scanned text is not OCRed. Tables are retained as source text, not represented as verified, normalised metrics.
- The baseline is an **extractive research assistant**, not a concealed LLM. It ranks genuine evidence. Optional synthesis is labelled separately. It does not claim to have reconciled four-quarter guidance against actuals automatically.
- Detailed financial table normalisation, management biographies, a verified guidance ledger, portfolio weights/P&L, robust multi-user jobs, background Web Push and comprehensive OCR are deliberately deferred.

Deployment steps, free-tier considerations, scheduler setup and GitHub publication commands are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
