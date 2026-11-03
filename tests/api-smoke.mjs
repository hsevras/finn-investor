import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
let mf;
if (process.env.FINN_IN_PROCESS === "1" || !process.env.FINN_BASE_URL) {
  const req = createRequire(
    realpathSync(
      new URL("../node_modules/wrangler/package.json", import.meta.url),
    ),
  );
  const { Miniflare } = req("miniflare");
  const root = new URL("../dist/server/", import.meta.url);
  const paths = (await readdir(root, { recursive: true })).filter((f) =>
    /\.m?js$/.test(f),
  );
  const modules = ["index.js", ...paths.filter((p) => p !== "index.js")].map(
    (path) => ({ type: "ESModule", path: new URL(path, root).pathname }),
  );
  mf = new Miniflare({
    modules,
    modulesRoot: root.pathname,
    compatibilityDate: "2026-05-15",
    compatibilityFlags: ["nodejs_compat"],
    modulesRules: [
      { type: "ESModule", include: ["**/*.js", "**/*.mjs"], fallthrough: true },
    ],
    d1Databases: { DB: "finn-test-only" },
    cf: false,
  });
  const db = await mf.getD1Database("DB");
  for (const file of (await readdir(new URL("../drizzle/", import.meta.url)))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(
      new URL("../drizzle/" + file, import.meta.url),
      "utf8",
    );
    for (const stmt of sql
      .split(";")
      .map((s) => s.replace(/--> statement-breakpoint/g, "").trim())
      .filter(Boolean))
      await db.prepare(stmt).run();
  }
  globalThis.fetch = (url, init) => mf.dispatchFetch(url, init);
}

const base = process.env.FINN_BASE_URL ?? "http://127.0.0.1:4173";
let cookie = "";
let passed = 0;
async function call(path, body, expected = 200) {
  const r = await fetch(base + "/api/finn/" + path, {
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined
      ? { method: "POST", body: JSON.stringify(body) }
      : {}),
  });
  const c = r.headers.get("set-cookie");
  if (c) cookie = c.split(";")[0];
  const d = await r.json();
  assert.equal(r.status, expected, JSON.stringify(d).slice(0, 300));
  return d;
}
async function check(name, fn) {
  await fn();
  passed++;
  console.log("PASS", name);
}
let original, first;
try {
  await check("real EOD and filing cache, 18-company portfolio", async () => {
    first = await call("briefing?hours=168");
    original = first.settings;
    assert.equal(original.symbols.length, 18);
    assert.equal(first.coverage.prices, 18);
    assert.ok(first.snapshot.filings.length > 50);
    assert.ok(first.signals.length > 0);
    assert.ok(first.snapshot.quotes.INFY.bars.length >= 21);
  });
  await check("rules persist and recalculate market signals", async () => {
    const settings = {
      ...original,
      rules: {
        ...original.rules,
        pricePercent: 20,
        volumeMultiple: 10,
        categories: [],
      },
    };
    await call("settings", settings);
    const r = await call("briefing?hours=168");
    assert.equal(r.signals.length, 0);
    assert.equal(r.settings.rules.pricePercent, 20);
  });
  await check(
    "server-backed bookmarks survive digest-window changes",
    async () => {
      const id = first.signals.find((s) => s.kind === "filing").id;
      await call("settings", { ...original, saved: [id] });
      const r = await call("briefing?hours=1");
      assert.equal(r.savedItems.length, 1);
      assert.equal(r.savedItems[0].id, id);
    },
  );
  await check("inbox deduplication and read receipts", async () => {
    await call("briefing");
    const a = await call("inbox");
    await call("briefing");
    const b = await call("inbox");
    assert.equal(a.items.length, b.items.length);
    await call("inbox/read", {});
    const c = await call("inbox");
    assert.ok(c.items.every((i) => i.readAt !== null));
  });
  await check(
    "primary-source research and page-linked evidence for the demo ticker",
    async () => {
      const r = await call("research?symbol=INFY");
      assert.ok(r.pack.chunks.length > 100);
      assert.ok(
        r.pack.documents.some(
          (d) => d.type === "annual_report" && d.status === "ready",
        ),
      );
      const a = await call("ask", {
        symbol: "INFY",
        question: "Is operating cash flow turning profit into cash?",
      });
      assert.equal(a.mode, "extractive");
      assert.ok(a.evidence.length > 0);
      assert.ok(
        a.evidence.every((e) => e.page > 0 && e.url.startsWith("https://")),
      );
    },
  );
  await check(
    "outside-portfolio research is backed by real documents",
    async () => {
      for (const symbol of ["KPITTECH", "PERSISTENT", "TRENT"]) {
        const r = await call("research?symbol=" + symbol);
        assert.ok(r.pack.chunks.length > 50, symbol);
      }
    },
  );
  await check("invalid threshold inputs are rejected", async () => {
    await call(
      "settings",
      { ...original, rules: { ...original.rules, pricePercent: -1 } },
      400,
    );
  });
  await check("cross-origin writes are rejected", async () => {
    const r = await fetch(base + "/api/finn/settings", {
      method: "POST",
      headers: {
        origin: "https://untrusted.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(original),
    });
    assert.equal(r.status, 403);
  });
} finally {
  if (original) await call("settings", original);
  if (mf) await mf.dispose();
}
console.log(`${passed} API smoke checks passed.`);
