/** Refresh the checked-in, dated fallback. Network errors remain visible in snapshot.errors. */
import { writeFile, mkdir } from "node:fs/promises";
import {
  fetchQuote,
  fetchFilings,
  discoverResearch,
  readDocument,
} from "../lib/finn/providers.ts";
import { COMPANIES } from "../lib/finn/universe.ts";
import type { ResearchPack, Snapshot } from "../lib/finn/types.ts";
const now = new Date(),
  start = new Date(now.getTime() - 30 * 86400000);
await mkdir("data", { recursive: true });
const skipMarket = process.argv.includes("--research-only");
const snapshot: Snapshot = {
  fetchedAt: now.toISOString(),
  windowStart: start.toISOString(),
  windowEnd: now.toISOString(),
  quotes: {},
  filings: [],
  errors: [],
};
if (!skipMarket)
  try {
    const filings = await fetchFilings(start, now);
    const symbols = new Set(COMPANIES.map((c) => c.symbol));
    snapshot.filings = filings.filter((f) => symbols.has(f.symbol));
    console.log(`${snapshot.filings.length} genuine NSE disclosures`);
  } catch (e) {
    snapshot.errors.push(String(e));
  }
const queue = skipMarket ? [] : [...COMPANIES];
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (queue.length) {
      const c = queue.shift()!;
      try {
        snapshot.quotes[c.symbol] = await fetchQuote(c.symbol);
        console.log(
          `Price ${c.symbol}: ${snapshot.quotes[c.symbol].bars.at(-1)?.date}`,
        );
      } catch (e) {
        snapshot.errors.push(String(e));
      }
    }
  }),
);
if (!skipMarket)
  await writeFile("data/snapshot.json", JSON.stringify(snapshot));
const researchSymbols = process.argv
  .slice(2)
  .filter((s) => !s.startsWith("--"));
if (!researchSymbols.length)
  researchSymbols.push("INFY", "KPITTECH", "TRENT", "PERSISTENT");
for (const symbol of researchSymbols) {
  try {
    const discovered = await discoverResearch(symbol);
    const pack: ResearchPack = {
      symbol,
      name: discovered.name,
      documents: [],
      chunks: [],
      fetchedAt: new Date().toISOString(),
      discoveryUrl: discovered.discoveryUrl,
      warnings: [],
    };
    // One annual report and the latest two calls for the ready-to-open cache. Runtime can load the rest.
    const docs = discovered.documents.filter(
      (d) =>
        d.type === "annual_report" ||
        discovered.documents
          .filter((x) => x.type === "transcript")
          .slice(0, 4)
          .some((x) => x.id === d.id),
    );
    for (const doc of docs) {
      const r = await readDocument(doc);
      pack.documents.push(r.document);
      pack.chunks.push(...r.chunks);
      console.log(
        symbol,
        doc.type,
        r.document.status,
        r.document.pages,
        r.document.error ?? "",
      );
    }
    for (const doc of discovered.documents)
      if (!pack.documents.some((d) => d.id === doc.id))
        pack.documents.push(doc);
    if (!pack.chunks.length)
      pack.warnings.push(
        "Primary documents could not be read. The source links are available; no research claims were generated.",
      );
    pack.warnings.push(
      "Annual report extraction covers at most the first 85 pages. Tables are evidence text, not normalised financial data.",
    );
    await writeFile(`data/research-${symbol}.json`, JSON.stringify(pack));
  } catch (e) {
    console.error(symbol, String(e));
  }
}
const { readdir, readFile } = await import("node:fs/promises");
const index: Record<string, ResearchPack> = {};
for (const name of await readdir("data"))
  if (/^research-[A-Z]+\.json$/.test(name)) {
    const pack = JSON.parse(await readFile("data/" + name, "utf8"));
    index[pack.symbol] = pack;
  }
await writeFile("data/research-index.json", JSON.stringify(index));
console.log(
  "Source collection complete; inspect data/snapshot.json errors before shipping.",
);
