import { and, desc, eq } from "drizzle-orm";
import { summarize } from "~/content/parse";
import { listDomains, readMarkdown, topicReadme } from "~/content/repo";
import { db } from "./client";
import { attempt, mark, note } from "./schema";

export type TopicProgress = {
  steps: number;
  stepsDone: number;
  recall: number;
  missed: number;
  bestScore: number | null;
  hasPractice: boolean;
};

export function topicState(topic: string) {
  const marks = db.select().from(mark).where(eq(mark.topic, topic)).all();
  return {
    steps: Object.fromEntries(marks.filter((m) => m.kind === "step").map((m) => [m.key, true])),
    recall: Object.fromEntries(marks.filter((m) => m.kind === "recall").map((m) => [m.key, m.value as "got" | "missed"])),
    note: db.select().from(note).where(eq(note.topic, topic)).get()?.body ?? "",
    attempts: db.select().from(attempt).where(eq(attempt.topic, topic)).orderBy(desc(attempt.id)).all(),
  };
}

/** Every domain and topic, with progress counted only against keys the README still has. */
export function overview() {
  const marks = db.select().from(mark).all();
  const attempts = db.select().from(attempt).all();
  return listDomains().map((d) => ({
    ...d,
    topics: d.topics.map((t) => {
      const file = topicReadme(t.domain, t.topic);
      if (!file) return { ...t, progress: null };
      const s = summarize(readMarkdown(file)!);
      const mine = marks.filter((m) => m.topic === t.id);
      const done = new Set(mine.filter((m) => m.kind === "step").map((m) => m.key));
      const missed = new Set(mine.filter((m) => m.kind === "recall" && m.value === "missed").map((m) => m.key));
      const scores = attempts.filter((a) => a.topic === t.id).map((a) => a.score);
      const progress: TopicProgress = {
        steps: s.stepKeys.length,
        stepsDone: s.stepKeys.filter((k) => done.has(k)).length,
        recall: s.recallKeys.length,
        missed: s.recallKeys.filter((k) => missed.has(k)).length,
        bestScore: scores.length ? Math.max(...scores) : null,
        hasPractice: s.hasPractice,
      };
      return { ...t, title: s.title, progress };
    }),
  }));
}

export function setMark(topic: string, kind: "step" | "recall", key: string, value: string | null) {
  const where = and(eq(mark.topic, topic), eq(mark.kind, kind), eq(mark.key, key));
  if (value === null) return db.delete(mark).where(where).run();
  db.insert(mark)
    .values({ topic, kind, key, value })
    .onConflictDoUpdate({ target: [mark.topic, mark.kind, mark.key], set: { value, updatedAt: new Date().toISOString() } })
    .run();
}

export function setNote(topic: string, body: string) {
  db.insert(note)
    .values({ topic, body })
    .onConflictDoUpdate({ target: note.topic, set: { body, updatedAt: new Date().toISOString() } })
    .run();
}

export function addAttempt(row: typeof attempt.$inferInsert) {
  db.insert(attempt).values(row).run();
}
