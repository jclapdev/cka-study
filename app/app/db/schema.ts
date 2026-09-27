import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

const now = () => new Date().toISOString();

/** A ticked step (value "done") or a graded Recall question (value "got" or "missed"). */
export const mark = sqliteTable(
  "mark",
  {
    topic: text().notNull(),
    kind: text({ enum: ["step", "recall"] }).notNull(),
    key: text().notNull(),
    value: text().notNull(),
    updatedAt: text().notNull().$defaultFn(now),
  },
  (t) => [primaryKey({ columns: [t.topic, t.kind, t.key] })],
);

export const note = sqliteTable("note", {
  topic: text().primaryKey(),
  body: text().notNull(),
  updatedAt: text().notNull().$defaultFn(now),
});

/** One finished Practice it run. Score is stored so later weight edits do not rewrite history. */
export const attempt = sqliteTable("attempt", {
  id: integer().primaryKey({ autoIncrement: true }),
  topic: text().notNull(),
  startedAt: text().notNull(),
  seconds: integer().notNull(),
  budgetSeconds: integer(),
  passed: text({ mode: "json" }).$type<number[]>().notNull(),
  score: integer().notNull(),
});
