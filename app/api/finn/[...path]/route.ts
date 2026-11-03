import { z } from "zod";
import {
  briefing,
  syncData,
  research,
  answer,
  loadResearchDocument,
  inspectFiling,
  preserveSaved,
  monitor,
} from "../../../../lib/finn/service";
import {
  getSettings,
  putSettings,
  readInbox,
  markRead,
  getCache,
  putCache,
} from "../../../../lib/finn/storage";
import { normalizeSymbol } from "../../../../lib/finn/engine";
import { DEFAULT_SETTINGS } from "../../../../lib/finn/universe";
export const dynamic = "force-dynamic";
const category = z.enum([
  "results",
  "M&A",
  "fund_raise",
  "management_change",
  "litigation",
  "insider_trading",
  "earnings_call",
  "investor_meetings",
  "credit_rating",
  "dividend",
  "bonus_split",
  "capex",
  "press_release",
  "postal_ballot",
  "agm_egm",
  "pledging",
  "unclassified",
]);
const settingsSchema = z.object({
  symbols: z.array(z.string().transform(normalizeSymbol)).min(1).max(30),
  rules: z.object({
    pricePercent: z.number().min(0.5).max(20),
    volumeMultiple: z.number().min(1.1).max(10),
    categories: z.array(category).max(17),
    pollMinutes: z.number().min(1).max(60),
  }),
  saved: z.array(z.string().max(100)).max(300),
  dismissed: z.array(z.string().max(100)).max(500),
});
function identity(request: Request) {
  const user = request.headers.get("oai-authenticated-user-id");
  if (user) return { owner: user, cookie: null };
  const cookie = request.headers
    .get("cookie")
    ?.match(/(?:^|; )finn_device=([a-f0-9-]{36})(?:;|$)/)?.[1];
  const device = cookie ?? crypto.randomUUID();
  return {
    owner: "device:" + device,
    cookie: cookie
      ? null
      : `finn_device=${device}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`,
  };
}
async function handle(request: Request) {
  const { owner, cookie } = identity(request);
  const u = new URL(request.url),
    action = u.pathname.split("/api/finn/")[1];
  const respond = (value: unknown, status = 200) =>
    Response.json(value, {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...(cookie ? { "Set-Cookie": cookie } : {}),
      },
    });
  try {
    if (request.method === "POST") {
      const origin = request.headers.get("origin");
      if (origin && origin !== u.origin)
        return respond({ error: "Cross-origin writes are not accepted." }, 403);
      if (Number(request.headers.get("content-length") ?? "0") > 16000)
        return respond({ error: "Request too large" }, 413);
      const raw = await request.text();
      if (raw.length > 16000)
        return respond({ error: "Request too large" }, 413);
      const body = raw ? JSON.parse(raw) : {};
      if (action === "settings") {
        const settings = settingsSchema.parse(body);
        settings.symbols = Array.from(new Set(settings.symbols));
        await preserveSaved(owner, settings);
        await putSettings(owner, settings);
        return respond({ settings });
      }
      if (action === "reset") {
        await preserveSaved(owner, structuredClone(DEFAULT_SETTINGS));
        await putSettings(owner, structuredClone(DEFAULT_SETTINGS));
        return respond({ ok: true });
      }
      if (action === "monitor") return respond(await monitor());
      if (action === "sync") {
        const last = await getCache<number>("sync-limit:" + owner);
        if (last && Date.now() - last.value < 60000)
          return respond(
            {
              error:
                "A refresh ran recently. Please wait a minute between refreshes.",
            },
            429,
          );
        await putCache("sync-limit:" + owner, Date.now());
        return respond(await syncData(await getSettings(owner)));
      }
      if (action === "ask") {
        const b = z
          .object({
            symbol: z.string().transform(normalizeSymbol),
            question: z.string().trim().min(3).max(600),
          })
          .parse(body);
        return respond(await answer(b.symbol, b.question));
      }
      if (action === "document") {
        const b = z
          .object({
            symbol: z.string().transform(normalizeSymbol),
            id: z.string().max(100),
          })
          .parse(body);
        return respond({
          pack: await loadResearchDocument(b.symbol, b.id),
          status: "live",
        });
      }
      if (action === "inbox/read") {
        await markRead(owner);
        return respond({ ok: true });
      }
    }
    if (request.method === "GET") {
      if (action === "health")
        return respond({
          ok: true,
          version: "1.0.0",
          time: new Date().toISOString(),
        });
      if (action === "briefing") {
        const hours = Math.min(
          720,
          Math.max(1, Number(u.searchParams.get("hours") ?? 24) || 24),
        );
        return respond(await briefing(owner, hours));
      }
      if (action === "research") {
        const symbol = normalizeSymbol(u.searchParams.get("symbol") ?? "INFY");
        return respond(
          await research(symbol, u.searchParams.get("refresh") === "1"),
        );
      }
      if (action === "filing") {
        return respond(
          await inspectFiling(
            z.string().regex(/^\d+$/).parse(u.searchParams.get("id")),
          ),
        );
      }
      if (action === "inbox") return respond({ items: await readInbox(owner) });
    }
    return respond({ error: "Endpoint not found" }, 404);
  } catch (e) {
    const validation = e instanceof z.ZodError;
    return respond(
      {
        error: validation
          ? "Invalid request. Check the ticker, thresholds and input length."
          : e instanceof Error
            ? e.message
            : "Request could not be completed.",
      },
      validation ? 400 : 502,
    );
  }
}
export const GET = handle;
export const POST = handle;
