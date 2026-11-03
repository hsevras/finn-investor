import type {
  Category,
  Quote,
  Rules,
  Signal,
  Filing,
  ResearchPack,
  Evidence,
} from "./types";
export function normalizeSymbol(input: string) {
  const s = input
    .trim()
    .toUpperCase()
    .replace(/\.(NS|BO)$/, "");
  if (!/^[A-Z0-9][A-Z0-9&-]{0,24}$/.test(s))
    throw new Error("Enter a valid NSE ticker, for example INFY or M&M.");
  return s;
}
export function classify(text: string): {
  category: Category;
  score: number;
  reason: string;
} {
  const t = text.toLowerCase();
  // Routine distributions and scheduled meetings must not masquerade as results.
  if (
    /newspaper|esop|esos|trading window|compliance certificate|reconciliation of share|loss of share|duplicate share|regulation 74|regulation 76/.test(
      t,
    )
  )
    return {
      category: "unclassified",
      score: 8,
      reason: "Routine disclosure; kept in the complete filing log.",
    };
  const rules: [Category, RegExp, number, string][] = [
    [
      "litigation",
      /penalt|litigation|insolven|regulatory order|fine\b|show cause|warning letter|fraud|default|sebi order/,
      96,
      "Potential legal, regulatory or solvency exposure.",
    ],
    [
      "management_change",
      /resign|chief financial|chief executive|change in management|appointment.*(?:director|cfo|ceo)|cessation.*director/,
      89,
      "Leadership change can affect execution and governance.",
    ],
    [
      "M&A",
      /acquisition|merger|demerger|joint venture|acquir|sale of.*stake/,
      88,
      "May change business mix, capital allocation or ownership.",
    ],
    [
      "results",
      /financial results|audited results|unaudited results|quarterly results|financial performance/,
      92,
      "New financial information; review the actual statement and reporting period.",
    ],
    [
      "pledging",
      /pledge|encumbrance/,
      87,
      "Promoter share encumbrances can increase financing risk.",
    ],
    [
      "fund_raise",
      /buyback|fund rais|rights issue|preferential|qualified institutional|qip\b|debenture|commercial paper/,
      82,
      "Changes capital structure or returns capital to shareholders.",
    ],
    [
      "capex",
      /capacity expansion|capital expenditure|new plant|new facility|capex|expansion of.*(?:center|centre)/,
      81,
      "New spending changes capacity, cash needs and execution risk.",
    ],
    [
      "credit_rating",
      /credit rating|rating.*(?:upgrade|downgrade|reaffirm)/,
      65,
      "Review the rating direction and the agency rationale.",
    ],
    [
      "earnings_call",
      /earnings call|con.?call|transcript|conference call/,
      64,
      "Primary management commentary; distinguish call notices from transcripts.",
    ],
    [
      "dividend",
      /dividend/,
      48,
      "Cash distribution; check amount and record date in the filing.",
    ],
    [
      "bonus_split",
      /bonus|stock split|sub.?division/,
      49,
      "Share count changes; it is not an economic return by itself.",
    ],
    [
      "insider_trading",
      /insider|promoter.*(?:purchase|sell|sale)|sast/,
      58,
      "Insider shareholding change; size and context determine relevance.",
    ],
    [
      "investor_meetings",
      /investor meet|analysts?.*meet|institutional investor/,
      17,
      "Meeting logistics; deprioritised unless new information is disclosed.",
    ],
    [
      "postal_ballot",
      /postal ballot/,
      15,
      "Shareholder voting process; inspect the underlying resolution.",
    ],
    [
      "agm_egm",
      /annual general meeting|extra.?ordinary|agm\b|egm\b/,
      15,
      "Shareholder meeting process.",
    ],
    [
      "press_release",
      /press release|order.*win|order.*receiv|contract.*award|business update|product|partnership|update|rumour|news verification/,
      42,
      "Business disclosure; assess financial materiality before acting.",
    ],
  ];
  const found = rules.find(([, re]) => re.test(t));
  return found
    ? {
        category: found[0],
        score: /board meeting intimation|meeting.*(?:consider|scheduled)/.test(
          t,
        )
          ? 30
          : found[2],
        reason: found[3],
      }
    : {
        category: "unclassified",
        score: 10,
        reason: "No reliable materiality rule matched; retained for review.",
      };
}
export function parseNseDate(value: string) {
  const m = value.match(/(\d{2})-([A-Za-z]{3})-(\d{4})[ T](\d{2}:\d{2}:\d{2})/);
  if (!m) return new Date(value).toISOString();
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month =
    months.findIndex((x) => x.toLowerCase() === m[2].toLowerCase()) + 1;
  if (!month) throw new Error("Invalid NSE date");
  return new Date(
    `${m[3]}-${String(month).padStart(2, "0")}-${m[1]}T${m[4]}+05:30`,
  ).toISOString();
}
export function quoteStats(q: Quote) {
  const bars = q.bars
    .filter(
      (b) =>
        Number.isFinite(b.close) &&
        b.close > 0 &&
        Number.isFinite(b.volume) &&
        b.volume >= 0,
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const last = bars.at(-1),
    prev = bars.at(-2),
    history = bars.slice(-21, -1);
  const avgVolume =
    history.length === 20
      ? history.reduce((s, b) => s + b.volume, 0) / 20
      : null;
  return {
    last,
    change: last && prev ? (last.close / prev.close - 1) * 100 : null,
    volumeRatio: last && avgVolume ? last.volume / avgVolume : null,
    avgVolume,
  };
}
export function buildSignals(
  filings: Filing[],
  quotes: Record<string, Quote>,
  rules: Rules,
  symbols: string[],
  start: string,
  end: string,
): Signal[] {
  const set = new Set(symbols),
    inWindow = (d: string) => d >= start && d <= end;
  const signals: Signal[] = [];
  for (const f of filings) {
    if (
      set.has(f.symbol) &&
      inWindow(f.publishedAt) &&
      rules.categories.includes(f.category) &&
      f.score >= 40
    )
      signals.push({
        id: `filing:${f.id}`,
        symbol: f.symbol,
        kind: "filing",
        title: f.subject,
        detail: f.summary,
        date: f.publishedAt,
        score: f.score,
        url: f.url,
        filing: f,
        reason: f.reason,
      });
  }
  for (const [symbol, q] of Object.entries(quotes)) {
    if (!set.has(symbol)) continue;
    const s = quoteStats(q);
    if (!s.last) continue;
    const date = `${s.last.date}T10:00:00.000Z`;
    if (!inWindow(date)) continue;
    if (s.change !== null && Math.abs(s.change) >= rules.pricePercent)
      signals.push({
        id: `price:${symbol}:${s.last.date}`,
        symbol,
        kind: "price",
        title: `${s.change >= 0 ? "+" : ""}${s.change.toFixed(1)}% at the close`,
        detail: `₹${s.last.close.toLocaleString("en-IN", { maximumFractionDigits: 2 })} · crossed your ±${rules.pricePercent}% threshold. A price move alone does not establish its cause.`,
        date,
        score: 74,
        reason: `Absolute close-to-close return ≥ ${rules.pricePercent}%. Split-adjusted historical closes; not an intraday trigger.`,
        url: q.source,
      });
    if (s.volumeRatio !== null && s.volumeRatio >= rules.volumeMultiple)
      signals.push({
        id: `volume:${symbol}:${s.last.date}`,
        symbol,
        kind: "volume",
        title: `${s.volumeRatio.toFixed(1)}× normal trading volume`,
        detail: `${(s.last.volume / 1e6).toFixed(2)}m shares traded against ${(s.avgVolume! / 1e6).toFixed(2)}m average over the previous 20 sessions.`,
        date,
        score: 72,
        reason: `Latest volume / previous 20-session mean ≥ ${rules.volumeMultiple}×. Current session excluded from baseline.`,
        url: q.source,
      });
  }
  return signals.sort(
    (a, b) => b.score - a.score || b.date.localeCompare(a.date),
  );
}
const STOP = new Set(
  "the a an and or of to in on for is are was were be been by as at this that with from how what does do it its company about me tell can please".split(
    " ",
  ),
);
const SYN: Record<string, string[]> = {
  cash: [
    "cash",
    "operating",
    "conversion",
    "receivables",
    "working",
    "capital",
    "flow",
  ],
  debt: ["debt", "borrowings", "leverage", "liabilities", "interest"],
  guidance: ["guidance", "expect", "outlook", "growth", "margin", "forecast"],
  business: [
    "business",
    "services",
    "products",
    "segments",
    "customers",
    "revenue",
  ],
  risks: ["risk", "uncertainty", "challenge", "decline", "adverse"],
  bear: ["risk", "uncertainty", "challenge", "decline", "adverse"],
  bull: ["growth", "demand", "opportunity", "order", "improve"],
  revenue: ["revenue", "sales", "income"],
  management: ["guidance", "management", "expect", "outlook"],
  margin: ["margin", "profitability", "operating", "ebitda"],
  promised: ["guidance", "expect", "outlook", "delivered", "growth"],
};
export function retrieve(
  pack: ResearchPack,
  query: string,
  limit = 4,
): Evidence[] {
  let words =
    query
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((w) => w.length > 2 && !STOP.has(w)) ?? [];
  words = Array.from(new Set(words.flatMap((w) => [w, ...(SYN[w] ?? [])])));
  if (!words.length) words = ["revenue", "growth", "business"];
  const docs = new Map(
    pack.documents.filter((d) => d.status === "ready").map((d) => [d.id, d]),
  );
  const frequency = new Map(
    words.map((w) => [
      w,
      pack.chunks.filter((x) => x.text.toLowerCase().includes(w)).length,
    ]),
  );
  const scored = pack.chunks
    .filter((c) => docs.has(c.documentId))
    .map((c) => {
      const t = c.text.toLowerCase(),
        len = Math.max(1, t.split(/\s+/).length);
      let score = 0;
      for (const w of words) {
        const matches = t.split(w).length - 1,
          df = frequency.get(w) ?? 0;
        score +=
          Math.log(1 + (pack.chunks.length + 1) / (df + 1)) *
          ((matches * 2.2) / (matches + 1.2 * (0.25 + (0.75 * len) / 130)));
      }
      if (
        /guidance|promised|management/.test(query) &&
        docs.get(c.documentId)?.type === "transcript"
      )
        score *= 1.4;
      return {
        ...c,
        score,
        ...{
          title: docs.get(c.documentId)!.title,
          url: docs.get(c.documentId)!.url,
          type: docs.get(c.documentId)!.type,
        },
      };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const chosen: Evidence[] = [];
  for (const c of scored) {
    if (chosen.length >= limit) break;
    if (
      chosen.filter((x) => x.documentId === c.documentId).length >= 2 &&
      scored.some(
        (x) =>
          x.score >= scored[0].score * 0.45 &&
          !chosen.some((y) => y.documentId === x.documentId),
      )
    )
      continue;
    if (!chosen.some((x) => x.documentId === c.documentId && x.page === c.page))
      chosen.push(c);
  }
  return chosen;
}
export function chunkText(documentId: string, pages: string[]) {
  return pages.flatMap((page, index) => {
    const text = page.replace(/\s+/g, " ").trim();
    const sentences = text
      .split(/(?<=[.!?])\s+(?=[A-Z₹(0-9])/)
      .flatMap((sentence) => {
        const words = sentence.split(" "),
          parts: string[] = [];
        for (let i = 0; i < words.length; i += 130)
          parts.push(words.slice(i, i + 130).join(" "));
        return parts;
      });
    const parts: string[] = [];
    let current = "";
    for (const sentence of sentences) {
      if (current.length + sentence.length > 1000 && current.length > 80) {
        parts.push(current);
        current = "";
      }
      current += (current ? " " : "") + sentence;
    }
    if (current.length > 80) parts.push(current);
    return parts.map((text, i) => ({
      id: `${documentId}-p${index + 1}-${i}`,
      documentId,
      page: index + 1,
      text,
    }));
  });
}
