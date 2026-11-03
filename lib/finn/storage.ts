import { env } from "cloudflare:workers";
import type { Settings, Signal } from "./types";
import { DEFAULT_SETTINGS } from "./universe";
function db() {
  if (!env.DB)
    throw new Error(
      "Database unavailable. Apply the documented D1 migration before starting.",
    );
  return env.DB;
}
export async function getCache<T>(
  key: string,
): Promise<{ value: T; fetchedAt: number } | null> {
  const row = await db()
    .prepare("SELECT value, fetched_at FROM source_cache WHERE key = ?")
    .bind(key)
    .first<{ value: string; fetched_at: number }>();
  return row
    ? { value: JSON.parse(row.value), fetchedAt: row.fetched_at }
    : null;
}
export async function putCache(key: string, value: unknown) {
  await db()
    .prepare(
      "INSERT INTO source_cache (key,value,fetched_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,fetched_at=excluded.fetched_at",
    )
    .bind(key, JSON.stringify(value), Date.now())
    .run();
}
export async function getSettings(owner: string): Promise<Settings> {
  const row = await db()
    .prepare("SELECT value FROM settings WHERE owner = ?")
    .bind(owner)
    .first<{ value: string }>();
  if (row)
    return { ...structuredClone(DEFAULT_SETTINGS), ...JSON.parse(row.value) };
  const defaults = structuredClone(DEFAULT_SETTINGS);
  await putSettings(owner, defaults);
  return defaults;
}
export async function putSettings(owner: string, settings: Settings) {
  await db()
    .prepare(
      "INSERT INTO settings (owner,value,updated_at) VALUES (?,?,?) ON CONFLICT(owner) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
    )
    .bind(owner, JSON.stringify(settings), Date.now())
    .run();
}
export async function deliver(owner: string, signals: Signal[]) {
  if (!signals.length) return;
  await db().batch(
    signals.slice(0, 60).map((s) =>
      db()
        .prepare(
          "INSERT OR IGNORE INTO inbox (id,owner,event_id,value,created_at) VALUES (?,?,?,?,?)",
        )
        .bind(owner + ":" + s.id, owner, s.id, JSON.stringify(s), Date.now()),
    ),
  );
}
export async function readInbox(owner: string) {
  const r = await db()
    .prepare(
      "SELECT event_id, value, created_at, read_at FROM inbox WHERE owner = ? ORDER BY created_at DESC LIMIT 80",
    )
    .bind(owner)
    .all<{
      event_id: string;
      value: string;
      created_at: number;
      read_at: number | null;
    }>();
  return r.results.map((row) => ({
    ...JSON.parse(row.value),
    createdAt: row.created_at,
    readAt: row.read_at,
  }));
}
export async function markRead(owner: string) {
  await db()
    .prepare("UPDATE inbox SET read_at = ? WHERE owner = ? AND read_at IS NULL")
    .bind(Date.now(), owner)
    .run();
}
export async function allOwners() {
  const r = await db()
    .prepare("SELECT owner,value FROM settings LIMIT 100")
    .all<{ owner: string; value: string }>();
  return r.results.map((r) => ({
    owner: r.owner,
    settings: JSON.parse(r.value) as Settings,
  }));
}
