import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSymbol,
  classify,
  quoteStats,
  buildSignals,
  parseNseDate,
  retrieve,
} from "../lib/finn/engine.ts";
import { discoverDocuments, mapNseRows } from "../lib/finn/providers.ts";
import type { Quote, ResearchPack } from "../lib/finn/types.ts";

test("arbitrary valid NSE symbols and suffixes; URL/path injection rejected", () => {
  assert.equal(normalizeSymbol(" m&m.ns "), "M&M");
  assert.equal(normalizeSymbol("NEWSTOCK"), "NEWSTOCK");
  for (const s of ["../INFY", "https://localhost", "A?x=1", ""])
    assert.throws(() => normalizeSymbol(s));
});
test("routine newspaper and ESOP disclosures are not quarterly-result signals", () => {
  assert.equal(
    classify("Publication of quarterly financial results in newspaper")
      .category,
    "unclassified",
  );
  assert.equal(classify("ESOP allotment").score, 8);
  assert.equal(classify("Unaudited financial results").category, "results");
  assert.ok(
    classify("Board Meeting Intimation to consider financial results").score <
      40,
  );
});
test("price returns and volume use only the preceding 20 sessions", () => {
  const q: Quote = {
    symbol: "X",
    currency: "INR",
    fetchedAt: "2026-11-03T12:00:00Z",
    source: "https://example.com",
    bars: Array.from({ length: 21 }, (_, i) => ({
      date: `2026-10-${String(i + 1).padStart(2, "0")}`,
      close: i === 20 ? 104 : 100,
      volume: i === 20 ? 300 : 100,
    })),
  };
  const s = quoteStats(q);
  assert.ok(Math.abs(s.change! - 4) < 1e-9);
  assert.equal(s.volumeRatio, 3);
  assert.equal(s.avgVolume, 100);
  const signals = buildSignals(
    [],
    { X: q },
    { pricePercent: 3, volumeMultiple: 2, categories: [], pollMinutes: 5 },
    ["X"],
    "2026-10-01T00:00:00Z",
    "2026-11-01T00:00:00Z",
  );
  assert.equal(signals.length, 2);
  assert.equal(
    buildSignals(
      [],
      { X: q },
      { pricePercent: 5, volumeMultiple: 4, categories: [], pollMinutes: 5 },
      ["X"],
      "2026-10-01",
      "2026-11-01",
    ).length,
    0,
  );
  assert.equal(
    buildSignals(
      [],
      { X: q },
      { pricePercent: 3, volumeMultiple: 2, categories: [], pollMinutes: 5 },
      ["Y"],
      "2026-10-01",
      "2026-11-01",
    ).length,
    0,
  );
  assert.equal(quoteStats({ ...q, bars: q.bars.slice(-5) }).volumeRatio, null);
});
test("NSE timestamps convert IST rather than treating local times as UTC", () => {
  assert.equal(
    parseNseDate("03-Nov-2026 17:28:17"),
    "2026-11-03T11:58:17.000Z",
  );
});
test("filings deduplicate at stable exchange ID and preserve source URL and timestamp", () => {
  const row = {
    seq_id: 12,
    symbol: "INFY",
    desc: "Financial results",
    attchmntText: "Revenue released",
    an_dt: "03-Nov-2026 17:00:00",
    attchmntFile: "https://nsearchives.nseindia.com/test.pdf",
  };
  assert.equal(mapNseRows([row, row]).length, 1);
  assert.equal(mapNseRows([row])[0].publishedAt, "2026-11-03T11:30:00.000Z");
});
test("document discovery admits only annual reports and raw transcripts, not screener summaries or ratings", () => {
  const h =
    '<h1>Test Ltd</h1><div class="documents annual-reports"><a href="https://www.bseindia.com/report.pdf">Annual Report 2026</a></div><div class="documents credit-ratings"><a href="https://broker.com/notes">Rating</a></div><div class="documents concalls"><li>Oct 2026<a title="Raw Transcript" href="https://issuer.com/call.pdf">Transcript</a><a href="https://screener.in/summary">AI Summary</a></li></div>';
  const d = discoverDocuments("TEST", h);
  assert.equal(d.documents.length, 2);
  assert.equal(d.documents[1].type, "transcript");
  assert.equal(d.documents[1].title, "Earnings call · Oct 2026");
  assert.equal(d.name, "Test Ltd");
});
test("retrieval is source bounded, page preserving and abstains on absent evidence", () => {
  const p: ResearchPack = {
    symbol: "X",
    name: "X",
    fetchedAt: "2026-11-03",
    discoveryUrl: "https://example.com",
    warnings: [],
    documents: [
      {
        id: "d",
        symbol: "X",
        title: "Annual report",
        type: "annual_report",
        url: "https://issuer.com/report.pdf",
        status: "ready",
        pages: 3,
      },
    ],
    chunks: [
      {
        id: "c",
        documentId: "d",
        page: 3,
        text: "Operating cash flow improved and receivables declined.",
      },
      {
        id: "bad",
        documentId: "unloaded",
        page: 1,
        text: "Cash debt guidance revenue",
      },
    ],
  };
  const result = retrieve(p, "cash conversion");
  assert.equal(result.length, 1);
  assert.equal(result[0].page, 3);
  assert.equal(result[0].url, "https://issuer.com/report.pdf");
  assert.equal(retrieve({ ...p, chunks: [] }, "cash").length, 0);
});
