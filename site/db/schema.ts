import { sql } from "drizzle-orm";
import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
export const ballots = sqliteTable("ballots", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ranking: text("ranking").notNull(),
  updatedAt: text("updated_at").notNull(),
}, table => [uniqueIndex("ballots_name_unique").on(sql`lower(trim(${table.name}))`)]);
