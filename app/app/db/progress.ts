import { and, desc, eq } from "drizzle-orm";
import { lessonHref, PASS_MARK } from "~/content/links";
import { type Lesson, summarize } from "~/content/parse";
import { learnTitle, listDomains, readMarkdown, topicReadme } from "~/content/repo";
import { db } from "./client";
import { attempt, mark, note, practiceRun, visit } from "./schema";

export type TopicProgress = {
  lessons: number;
  lessonsDone: number;
  recall: number;
  missed: number;
  bestScore: number | null;
  hasPractice: boolean;
};

export type PracticeRun = typeof practiceRun.$inferSelect;

export function topicState(topic: string) {
  const marks = db.select().from(mark).where(eq(mark.topic, topic)).all();
  return {
    steps: Object.fromEntries(marks.filter((m) => m.kind === "step").map((m) => [m.key, true])),
    recall: Object.fromEntries(marks.filter((m) => m.kind === "recall").map((m) => [m.key, m.value as "got" | "missed"])),
    note: db.select().from(note).where(eq(note.topic, topic)).get()?.body ?? "",
    attempts: db.select().from(attempt).where(eq(attempt.topic, topic)).orderBy(desc(attempt.id)).all(),
    run: practiceRunOf(topic),
  };
}

/**
 * Whether a lesson is done: Introduction and Learn pages once opened, a lesson with steps when every
 * step is ticked, the quiz when every question is marked Got it, Practice once a saved score reaches
 * the pass mark.
 */
function lessonDone(l: Lesson, t: { visited: Set<string>; steps: Set<string>; got: Set<string>; recallKeys: string[]; best: number | null }) {
  switch (l.kind) {
    case "intro":
    case "learn":
      return t.visited.has(l.slug);
    case "steps":
      return l.stepKeys.length > 0 && l.stepKeys.every((k) => t.steps.has(k));
    case "recall":
      return t.recallKeys.length > 0 && t.recallKeys.every((k) => t.got.has(k));
    case "practice":
      return t.best !== null && t.best >= PASS_MARK;
  }
}

/** Every domain and topic, with progress counted only against lessons and keys the README still has. */
export function overview() {
  const marks = db.select().from(mark).all();
  const attempts = db.select().from(attempt).all();
  const visits = db.select().from(visit).all();
  return listDomains().map((d) => ({
    ...d,
    topics: d.topics.map((t) => {
      const file = topicReadme(t.domain, t.topic);
      if (!file) return { ...t, progress: null };
      const s = summarize(readMarkdown(file)!, learnTitle);
      const mine = marks.filter((m) => m.topic === t.id);
      const scores = attempts.filter((a) => a.topic === t.id).map((a) => a.score);
      const state = {
        visited: new Set(visits.filter((v) => v.topic === t.id).map((v) => v.lesson)),
        steps: new Set(mine.filter((m) => m.kind === "step").map((m) => m.key)),
        got: new Set(mine.filter((m) => m.kind === "recall" && m.value === "got").map((m) => m.key)),
        recallKeys: s.recallKeys,
        best: scores.length ? Math.max(...scores) : null,
      };
      const missed = new Set(mine.filter((m) => m.kind === "recall" && m.value === "missed").map((m) => m.key));
      const lessons = s.lessons.map((l) => ({ slug: l.slug, title: l.title, done: lessonDone(l, state) }));
      const progress: TopicProgress = {
        lessons: lessons.length,
        lessonsDone: lessons.filter((l) => l.done).length,
        recall: s.recallKeys.length,
        missed: s.recallKeys.filter((k) => missed.has(k)).length,
        bestScore: state.best,
        hasPractice: s.hasPractice,
      };
      return { ...t, title: s.title, lab: s.lab, lessons, progress };
    }),
  }));
}

/** Where Continue goes: the lesson opened last, or its topic when that lesson is gone. Null before any. */
export function lastLesson(domains: ReturnType<typeof overview>) {
  for (const v of db.select().from(visit).orderBy(desc(visit.at)).all()) {
    const topic = domains.flatMap((d) => d.topics).find((t) => t.id === v.topic && "lessons" in t);
    if (!topic || !("lessons" in topic)) continue;
    const lesson = topic.lessons.find((l) => l.slug === v.lesson);
    return { topic: topic.id, title: lesson?.title ?? null, href: lessonHref(topic.id, lesson?.slug ?? topic.lessons[0].slug) };
  }
  return null;
}

export function recordVisit(topic: string, lesson: string) {
  const at = new Date().toISOString();
  db.insert(visit).values({ topic, lesson, at }).onConflictDoUpdate({ target: [visit.topic, visit.lesson], set: { at } }).run();
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

export const practiceRunOf = (topic: string) => db.select().from(practiceRun).where(eq(practiceRun.topic, topic)).get() ?? null;

/** The topic whose practice exam is under way, if any. */
export const openRunTopic = () => db.select().from(practiceRun).get()?.topic ?? null;

export function startPracticeRun(topic: string, startedAt: string | null) {
  db.delete(practiceRun).run();
  db.insert(practiceRun).values({ topic, startedAt }).run();
}

export function updatePracticeRun(topic: string, set: Partial<Omit<PracticeRun, "topic">>) {
  db.update(practiceRun).set(set).where(eq(practiceRun.topic, topic)).run();
}

export const endPracticeRun = (topic: string) => db.delete(practiceRun).where(eq(practiceRun.topic, topic)).run();

/** A lab start recreates the machines, so every practice exam under way ends with it. */
export const endPracticeRuns = () => db.delete(practiceRun).run();
