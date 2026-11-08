import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const folders = pgTable("folders", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  parentId: text("parent_id"),
  color: text("color").notNull().default("sage"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notes = pgTable("notes", {
  id: text("id").primaryKey(),
  title: text("title").notNull().default("Untitled note"),
  content: text("content").notNull().default(""),
  folderId: text("folder_id").references(() => folders.id, { onDelete: "set null" }),
  favorite: boolean("favorite").notNull().default(false),
  deleted: boolean("deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastOpenedAt: timestamp("last_opened_at", { withTimezone: true }).notNull().defaultNow(),
});
