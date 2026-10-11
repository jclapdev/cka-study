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

/** One finished practice exam. Score is stored so later weight edits do not rewrite history. */
export const attempt = sqliteTable("attempt", {
  id: integer().primaryKey({ autoIncrement: true }),
  topic: text().notNull(),
  startedAt: text().notNull(),
  seconds: integer().notNull(),
  budgetSeconds: integer(),
  passed: text({ mode: "json" }).$type<number[]>().notNull(),
  score: integer().notNull(),
});

/** Each lesson opened, and when it was last opened: Continue returns to the latest. */
export const visit = sqliteTable(
  "visit",
  {
    topic: text().notNull(),
    lesson: text().notNull(),
    at: text().notNull().$defaultFn(now),
  },
  (t) => [primaryKey({ columns: [t.topic, t.lesson] })],
);

/**
 * The practice exam under way in a topic, kept until Save score or Quit so a reload or another lesson
 * doesn't lose it. `startedAt` is empty until the lab it reset is running. `results` holds each checked
 * task by number, or why its check couldn't run, and under "all" why checking every task failed.
 */
export const practiceRun = sqliteTable("practice_run", {
  topic: text().primaryKey(),
  startedAt: text(),
  endedAt: text(),
  results: text({ mode: "json" }).$type<Record<string, unknown>>().notNull().$defaultFn(() => ({})),
  passed: text({ mode: "json" }).$type<number[]>().notNull().$defaultFn(() => []),
});
