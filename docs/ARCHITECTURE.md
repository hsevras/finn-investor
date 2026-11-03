# Architecture and judgment

The product has two loops: **scan → inspect → save**, and **question → primary evidence → original page**. A ranked briefing is the default surface because the investor’s first question is usually “What deserves attention?”, rather than “What can I ask a chatbot?”

The browser talks only to same-origin route handlers. Providers execute on the server. Durable D1 records own the watchlist, rules, reading list, source cache, inbox and read receipts. Device cookies scope anonymous local workspaces; hosted identity uses the platform’s authenticated user ID. The private hosted access boundary must be retained. A public production deployment should put its own trusted authentication gateway in front of the app and strip spoofed identity headers.

## Data path

Yahoo chart JSON → completed-session history → validated closes/volumes → deterministic thresholds.

NSE announcement JSON → stable exchange IDs and IST-to-UTC conversion → category/priority rules → user-category filtering → inbox insertion with a stable unique event ID.

NSE annual-report index + company announcement archive / Screener document links → underlying issuer/exchange PDFs → bounded extraction retaining physical page number → sentence-safe chunks → finance-aware term expansion and BM25-style ranking → page-linked evidence. An optional Groq call synthesises only the retrieval set.

No search-engine news, broker research, Screener AI summary, or model-pretrained company fact is a pull-side input. NSE is sufficient for the announcement requirement; a second BSE feed would add duplication and a second fragile integration. BSE document links remain a fallback when discovered, but the NSE archive is preferred because BSE denied downloads in the build environment.

## Calculations and time semantics

Daily return = `(latest adjusted close / previous adjusted close − 1) × 100`.

Volume ratio = `latest completed-session volume / mean(volume of preceding 20 completed sessions)`. The current session is excluded from the denominator. No volume signal is emitted if fewer than 20 historical baseline sessions are available. Zero-volume baselines do not divide by zero.

The Yahoo adjusted series reduces split/dividend discontinuities. It is not a live executable quote and does not provide an exchange-certified corporate-action-adjusted turnover series. The collector excludes the current Indian-market session before 16:00 IST to give end-of-day data time to settle.

Digest windows are relative to current wall-clock time, never silently shifted to the cache date. Filings retain actual publication timestamps. A stale cache may therefore produce an empty recent window; the user can select 7/30 days or refresh. Monitoring always evaluates the last day independently of the selected digest window.

The category score is a triage rule, not a probability or financial-materiality model. Disclosures can be important for reasons not inferable from the title. The complete filing desk remains available. Exchange records are deduplicated by ID; economically related disclosures are not falsely merged as one event.

## Cost and reliability

- No model calls in ingestion, triage, arithmetic or the baseline evidence view.
- Persistent source caches and pre-extracted demo evidence keep cold-start demonstration usable.
- Active-tab monitoring shares a minimum refresh interval; scheduled jobs share the fetched sources across owners.
- PDF byte, page, redirect and network time limits bound work. User-provided URLs are not accepted by a document fetch endpoint.
- Failed research refreshes fall back only to existing evidence for the **same ticker**, with a visible warning. A company with no evidence receives a source-discovery gap, never a fabricated profile.
- Saving a signal stores its event snapshot; switching digest windows does not lose the saved item.

Free hosting is plausible for a small prototype, but actual PDF CPU, Worker bundle size, D1 storage and provider rate limits matter. The starter/framework bundle plus PDF library can exceed the smallest Worker free-plan bundle allowance; use local mode or a compatible hosted plan rather than assuming every cloud account can deploy this exact bundle free. Do not promise a zero-cost production service without measuring its workload.

## Trust and remaining risks

Inputs are validated, SQL is parameterised, writes reject a foreign Origin, response data is rendered as text, and secrets remain server-side. User records use an owner key; global source caches contain public documents only. The app does not execute model-generated code or document instructions.

The default evidence engine has lexical, not semantic, recall. It can retrieve a relevant sentence without resolving an accounting-basis ambiguity. It does not convert arbitrary PDF tables into an investment model. Citation-ID validation cannot establish semantic entailment. Public-source access is best-effort, not an availability guarantee.

Next work should first improve a single analytical workflow: normalise consolidated quarterly statements with explicit period/currency/unit checks, then build a guidance ledger with human-verifiable matches. OCR, complete AR extraction in background jobs, retrieval evaluation, robust job leases and authenticated multi-user delivery follow from that foundation.
