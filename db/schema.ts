import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const settings = sqliteTable("settings", {
  owner: text("owner").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
export const cache = sqliteTable("source_cache", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  fetchedAt: integer("fetched_at").notNull(),
});
export const inbox = sqliteTable("inbox", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  eventId: text("event_id").notNull(),
  value: text("value").notNull(),
  createdAt: integer("created_at").notNull(),
  readAt: integer("read_at"),
});
