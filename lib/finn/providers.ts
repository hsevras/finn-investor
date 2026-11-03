import type { Filing, Quote, SourceDocument, ResearchPack } from "./types";
import {
  classify,
  normalizeSymbol,
  parseNseDate,
  chunkText,
} from "./engine.ts";

const UA = "Mozilla/5.0 (compatible; FINN-Research/1.0)";
export function cleanHtml(s: string) {
  return s
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([\da-f]+);/gi, (_, v) =>
      String.fromCodePoint(parseInt(v, 16)),
    )
    .replace(/&#(\d+);/g, (_, v) => String.fromCodePoint(+v))
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
function publicUrl(raw: string) {
  const u = new URL(raw);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.port ||
    /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[|0\.)/.test(
      u.hostname,
    ) ||
    !u.hostname.includes(".")
  )
    throw new Error("Only public HTTPS primary documents are supported.");
  return u;
}
export async function boundedFetch(
  url: string,
  timeout = 11000,
  maxBytes = 25_000_000,
) {
  publicUrl(url);
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), timeout);
  try {
    // Check every redirect. A discovered URL must not become an internal-network request.
    let current = url;
    for (let redirects = 0; redirects < 4; redirects++) {
      publicUrl(current);
      const r = await fetch(current, {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent": UA,
          Accept: "*/*",
          Referer: new URL(current).origin + "/",
        },
      });
      if (r.status >= 300 && r.status < 400) {
        const location = r.headers.get("location");
        if (!location) throw new Error("Empty redirect");
        current = new URL(location, current).href;
        continue;
      }
      if (!r.ok) throw new Error(`Source returned HTTP ${r.status}`);
      if (Number(r.headers.get("content-length")) > maxBytes)
        throw new Error("Document exceeds 25 MB download limit.");
      const reader = r.body?.getReader();
      if (!reader) throw new Error("Source returned an empty response");
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > maxBytes) {
          await reader.cancel();
          throw new Error("Source exceeds download limit.");
        }
        chunks.push(value);
      }
      const data = new Uint8Array(bytes);
      let offset = 0;
      for (const chunk of chunks) {
        data.set(chunk, offset);
        offset += chunk.length;
      }
      return {
        data,
        contentType: r.headers.get("content-type") ?? "",
        url: current,
      };
    }
    throw new Error("Too many redirects");
  } finally {
    clearTimeout(timer);
  }
}
export async function fetchQuote(raw: string): Promise<Quote> {
  const symbol = normalizeSymbol(raw);
  let error = "";
  for (const host of ["query2.finance.yahoo.com", "query1.finance.yahoo.com"]) {
    try {
      const u = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol + ".NS")}?range=3mo&interval=1d`;
      const { data } = await boundedFetch(u, 8000, 1_000_000);
      const parsed = JSON.parse(new TextDecoder().decode(data));
      const r = parsed.chart?.result?.[0];
      if (!r)
        throw new Error(parsed.chart?.error?.description ?? "No price series");
      const i = r.indicators.quote[0],
        adj = r.indicators.adjclose?.[0]?.adjclose;
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      const minutes =
        Number(
          new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            hour12: false,
          }).format(new Date()),
        ) *
          60 +
        Number(
          new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Kolkata",
            minute: "2-digit",
          }).format(new Date()),
        );
      const bars = r.timestamp
        .map((ts: number, n: number) => ({
          date: new Date(ts * 1000).toISOString().slice(0, 10),
          close: adj?.[n] ?? i.close[n],
          volume: i.volume[n],
        }))
        .filter(
          (b: { date: string; close: number; volume: number }) =>
            b.close !== null &&
            b.volume !== null &&
            Number.isFinite(b.close) &&
            b.close > 0 &&
            b.volume >= 0 &&
            (b.date < today || (b.date === today && minutes >= 960)),
        );
      if (bars.length < 2) throw new Error("Fewer than two completed sessions");
      return {
        symbol,
        currency: r.meta.currency ?? "INR",
        bars,
        fetchedAt: new Date().toISOString(),
        source: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol + ".NS")}/history/`,
      };
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(`Price unavailable for ${symbol}: ${error}`);
}
export function mapNseRows(rows: Record<string, unknown>[]): Filing[] {
  const seen = new Set<string>();
  return rows.flatMap((r) => {
    try {
      const id = String(r.seq_id ?? r.symbol + "-" + r.an_dt);
      if (seen.has(id)) return [];
      seen.add(id);
      const subject = cleanHtml(String(r.desc ?? "Exchange disclosure")),
        summary = cleanHtml(String(r.attchmntText ?? subject));
      const cls = classify(subject + " " + summary);
      const link = String(r.attchmntFile ?? "");
      return [
        {
          id,
          symbol: normalizeSymbol(String(r.symbol)),
          company: String(r.sm_name ?? r.symbol),
          subject,
          summary,
          publishedAt: parseNseDate(String(r.an_dt)),
          url: link.startsWith("https://")
            ? link
            : "https://www.nseindia.com/companies-listing/corporate-filings-announcements",
          ...cls,
        },
      ];
    } catch {
      return [];
    }
  });
}
export async function fetchFilings(start: Date, end: Date): Promise<Filing[]> {
  const date = (d: Date) =>
    `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;
  const url = `https://www.nseindia.com/api/corporate-announcements?index=equities&from_date=${date(start)}&to_date=${date(end)}`;
  const { data } = await boundedFetch(url, 14000, 12_000_000);
  const rows = JSON.parse(new TextDecoder().decode(data));
  if (!Array.isArray(rows))
    throw new Error("NSE returned an unexpected response");
  return mapNseRows(rows);
}
export function discoverDocuments(
  symbol: string,
  html: string,
): { name: string; documents: SourceDocument[] } {
  const heading = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const name = heading ? cleanHtml(heading[1]) : symbol;
  const documents: SourceDocument[] = [];
  const section = (marker: string) => {
    const i = html.indexOf(marker);
    if (i < 0) return "";
    const start = html.lastIndexOf("<div", i);
    const next = html.indexOf('<div class="documents ', i + marker.length);
    return html.slice(start, next > i ? next : i + 27000);
  };
  const annual = section("documents annual-reports"),
    calls = section("documents concalls");
  for (const [type, part] of [
    ["annual_report", annual],
    ["transcript", calls],
  ] as const) {
    let count = 0;
    for (const m of part.matchAll(
      /<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi,
    )) {
      const text = cleanHtml(m[4]),
        attrs = m[1] + m[3];
      if (type === "annual_report" && !/Annual Report \d{4}/i.test(text))
        continue;
      if (
        type === "transcript" &&
        (!/^Transcript$/i.test(text) ||
          (!/Raw Transcript/i.test(attrs) && !/\.pdf(?:\?|$)/i.test(m[2])))
      )
        continue;
      const url = m[2].replace(/&amp;/g, "&");
      try {
        publicUrl(url);
      } catch {
        continue;
      }
      const before = part.slice(Math.max(0, m.index! - 250), m.index);
      const period = before
        .match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}/g)
        ?.at(-1);
      documents.push({
        id: `${symbol}-${type}-${count}`,
        symbol,
        title:
          type === "annual_report"
            ? text
            : `Earnings call · ${period ?? `recent ${count + 1}`}`,
        type,
        url,
        status: "discovered",
        pages: 0,
      });
      if (++count >= (type === "annual_report" ? 1 : 4)) break;
    }
  }
  return { name, documents };
}
export async function readDocument(
  doc: SourceDocument,
): Promise<{ document: SourceDocument; chunks: ResearchPack["chunks"] }> {
  try {
    const { data, contentType } = await boundedFetch(doc.url, 15000);
    if (
      !contentType.includes("pdf") &&
      new TextDecoder().decode(data.slice(0, 5)) !== "%PDF-"
    )
      throw new Error(
        "Source is not a text PDF. Open the original document to inspect it.",
      );
    const { getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(data);
    const pages: string[] = [];
    // Annual reports can be hundreds of pages. Scan a bounded, explicitly disclosed set.
    const maxPages =
      doc.type === "annual_report"
        ? Math.min(pdf.numPages, 85)
        : Math.min(pdf.numPages, 45);
    try {
      for (let p = 1; p <= maxPages; p++) {
        const page = await pdf.getPage(p);
        const tc = await page.getTextContent();
        let text = "";
        let prevY: number | undefined;
        for (const item of tc.items) {
          if ("str" in item) {
            const y = item.transform[5];
            text +=
              (prevY !== undefined && Math.abs(y - prevY) > 3 ? "\n" : " ") +
              item.str;
            prevY = y;
          }
        }
        pages.push(text);
      }
    } finally {
      await pdf.cleanup();
    }
    const chunks = chunkText(doc.id, pages);
    if (!chunks.length)
      throw new Error("No extractable text; this PDF may require OCR.");
    return {
      document: {
        ...doc,
        status: "ready",
        pages: maxPages,
        fetchedAt: new Date().toISOString(),
      },
      chunks,
    };
  } catch (e) {
    return {
      document: {
        ...doc,
        status: "failed",
        error: e instanceof Error ? e.message : String(e),
      },
      chunks: [],
    };
  }
}
async function nseResearchDocuments(
  symbol: string,
): Promise<{ name: string; documents: SourceDocument[] }> {
  const now = new Date(),
    lastYear = new Date(now.getTime() - 365 * 86400000);
  const date = (d: Date) =>
    `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;
  const results = await Promise.allSettled([
    boundedFetch(
      `https://www.nseindia.com/api/annual-reports?index=equities&symbol=${encodeURIComponent(symbol)}`,
      11000,
      2_000_000,
    ),
    boundedFetch(
      `https://www.nseindia.com/api/corporate-announcements?index=equities&symbol=${encodeURIComponent(symbol)}&from_date=${date(lastYear)}&to_date=${date(now)}`,
      11000,
      5_000_000,
    ),
  ]);
  let name = symbol;
  const documents: SourceDocument[] = [];
  if (results[0].status === "fulfilled") {
    const raw = JSON.parse(new TextDecoder().decode(results[0].value.data));
    const rows = Array.isArray(raw) ? raw : raw.data;
    if (Array.isArray(rows))
      for (const r of rows.slice(0, 1)) {
        if (
          typeof r.fileName === "string" &&
          r.fileName.startsWith("https://nsearchives.nseindia.com/")
        ) {
          name = r.companyName ?? symbol;
          documents.push({
            id: `${symbol}-annual-nse-${r.toYr}`,
            symbol,
            title: `Annual Report ${r.toYr}`,
            type: "annual_report",
            url: r.fileName,
            status: "discovered",
            pages: 0,
          });
        }
      }
  }
  if (results[1].status === "fulfilled") {
    const rows = JSON.parse(new TextDecoder().decode(results[1].value.data));
    if (Array.isArray(rows)) {
      const found = rows
        .filter(
          (r) =>
            /transcript/i.test(String(r.attchmntText) + " " + String(r.desc)) &&
            !/annual general meeting|\bagm\b|postal ballot|investor day|analyst day|shareholders meeting/i.test(
              String(r.attchmntText) + " " + String(r.desc),
            ) &&
            String(r.attchmntFile).startsWith(
              "https://nsearchives.nseindia.com/",
            ),
        )
        .slice(0, 4);
      for (const r of found) {
        let period = "";
        try {
          period = new Date(parseNseDate(r.an_dt)).toLocaleDateString("en-GB", {
            month: "short",
            year: "numeric",
            timeZone: "Asia/Kolkata",
          });
        } catch {}
        documents.push({
          id: `${symbol}-transcript-nse-${r.seq_id}`,
          symbol,
          title: `Earnings call · ${period}`,
          type: "transcript",
          url: r.attchmntFile,
          status: "discovered",
          pages: 0,
        });
      }
    }
  }
  return { name, documents };
}
export async function discoverResearch(symbol: string) {
  const u = `https://www.screener.in/company/${encodeURIComponent(symbol)}/consolidated/`;
  const results = await Promise.allSettled([
    (async () => {
      let html: string;
      try {
        const r = await boundedFetch(u, 10000, 2_000_000);
        html = new TextDecoder().decode(r.data);
      } catch {
        const r = await boundedFetch(
          u.replace("/consolidated/", "/"),
          8000,
          2_000_000,
        );
        html = new TextDecoder().decode(r.data);
      }
      return discoverDocuments(symbol, html);
    })(),
    nseResearchDocuments(symbol),
  ]);
  const screener = results[0].status === "fulfilled" ? results[0].value : null,
    nse = results[1].status === "fulfilled" ? results[1].value : null;
  // NSE archive URLs are more reliable than BSE's gated PDF route in an edge runtime.
  const documents = [...(nse?.documents ?? [])];
  for (const d of screener?.documents ?? []) {
    if (d.type === "annual_report" && documents.some((x) => x.type === d.type))
      continue;
    if (
      d.type === "transcript" &&
      documents
        .filter((x) => x.type === "transcript")
        .some((x) => x.title === d.title)
    )
      continue;
    documents.push(d);
  }
  if (!documents.length)
    throw new Error(
      "No accessible primary documents found. " +
        results
          .map((r, i) =>
            r.status === "rejected"
              ? `${i === 0 ? "Screener" : "NSE"}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`
              : "",
          )
          .filter(Boolean)
          .join("; "),
    );
  return {
    name: screener?.name ?? nse?.name ?? symbol,
    documents: documents
      .filter((x) => x.type === "annual_report")
      .slice(0, 1)
      .concat(documents.filter((x) => x.type === "transcript").slice(0, 4)),
    discoveryUrl: u,
  };
}
