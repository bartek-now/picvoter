import { sqliteTable, text } from "drizzle-orm/sqlite-core";
export const ballots = sqliteTable("ballots", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ranking: text("ranking").notNull(),
  updatedAt: text("updated_at").notNull(),
});
