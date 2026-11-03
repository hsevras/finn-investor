# Verification report — 3 November 2026

## Executed successfully

- Production Vinext build, including Worker and browser output.
- TypeScript strict `tsc --noEmit` check.
- Seven core tests: arbitrary ticker validation; routine-vs-results classification; adjusted close return and 20-prior-session volume math; IST timestamp conversion; stable exchange-ID deduplication; primary-only document discovery; source-bounded retrieval and abstention on missing evidence.
- Eight integration checks against the **compiled Worker**, isolated Miniflare and a fresh migrated D1 database: real seeded EOD/filings and 18-company defaults; persisted rules changing signals; bookmarks surviving window changes; deduplicated inbox/read receipts; primary-source/page-preserving research; all three outside-portfolio cached companies; invalid thresholds rejected; foreign-Origin writes rejected.
- Fresh local D1 migration setup was also exercised in a separate disposable state directory.
- Browser QA of desktop and 390px embedded viewport: briefing render, mobile bottom navigation, actual signal save confirmation, company research transition, and cash-quality question returning primary passages and original page links.
- Real source collector obtained 22 Yahoo EOD histories and 298 filtered NSE disclosures, with no price/filing collection errors in the delivered market seed. The default portfolio uses the first 18 companies.
- Research caches were actually extracted from primary PDFs: Infosys, KPIT, Persistent and Trent. A separate, uncached **COFORGE** probe discovered its NSE annual report and extracted the first 85 pages, confirming that the standalone provider pipeline is not hard-wired to the demo list.

## Observed limitations

- BSE PDF access returned HTTP 403 in this environment; the generic NSE annual-report and transcript archive routes worked from the Node collector.
- The hosted development preview could not discover COFORGE’s live sources although the same provider code worked in standalone Node. The UI surfaced a source gap. Public-source availability is therefore runtime/IP dependent; new-ticker research is not guaranteed from every hosted environment.
- No Groq key was available, so the optional synthesis branch was implemented and statically checked but not exercised against a live model. The zero-key evidence path was exercised.
- A source refresh can still fail or partially succeed. Prior valid records retain their own dates; the app does not present fallback records as newly collected.
- Annual report text is bounded to 85 physical pages and transcripts to 45. Trent has an annual report cache, not an invented earnings-call transcript. There is no OCR or verified financial-table normalisation.
- The prototype’s scheduled handler exists; an actual cron schedule is only enabled by the supplied standalone deployment config. No OS push or email integration was tested or claimed.
- This is focused prototype verification, not a complete penetration, accessibility, cross-browser, load or financial-data audit.

Commands to reproduce are in the README. The API test uses isolated state and can be run after every production build. Data-provider tests are deliberately separate from the deterministic test suite to avoid claiming that unreliable external endpoints are always available.

## Deployed-runtime verification

The production health endpoint, 18-company briefing and Infosys research endpoint all returned HTTP 200. A fresh, uncached COFORGE research request also returned HTTP 200 with `status: live`, an 85-page annual-report extraction and page-linked evidence. This confirms that the production provider route can generalise beyond the bundled examples, even though the development preview had a source-access limitation. One discovered COFORGE transcript filing contained only a one-page covering letter; other transcripts remain explicitly not loaded, so complete call coverage is not claimed.
