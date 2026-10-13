import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { useEffect, useLayoutEffect, useState } from "react";
import { data, Link, redirect, useLocation, useNavigationType, useRouteLoaderData } from "react-router";
import type { Route } from "./+types/topic";
import type { loader as rootLoader } from "~/root";
import { INTRO, lessonHref } from "~/content/links";
import { inTopic, parseExercise, renderDoc, untitled } from "~/content/parse";
import { hasGrader, learnTitle, readMarkdown, REPO, topicReadme } from "~/content/repo";
import {
  addAttempt,
  endPracticeRun,
  practiceRunOf,
  recordVisit,
  setMark,
  startPracticeRun,
  topicState,
  updatePracticeRun,
} from "~/db/progress";
import { Markdown } from "~/components/Markdown";
import { Notes } from "~/components/Notes";
import { PracticeRun } from "~/components/PracticeRun";
import { RecallCard } from "~/components/RecallCard";
import { Step } from "~/components/Step";
import { useLab } from "~/components/LabPane";
import { Pane } from "~/components/Pane";
import { usePopout } from "~/components/popout";
import { useReferences } from "~/components/ReferencePanel";
import { BusyError, labController } from "~/lab/controller";
import { parseGrade, type TaskResult } from "~/lab/grade";
import { Split } from "~/components/Split";
import { setPref } from "~/prefs";
import { fromApp } from "~/request.server";
import { SidebarIcon } from "~/root";

async function load(params: Route.LoaderArgs["params"]) {
  const file = topicReadme(params.domain, params.topic);
  if (!file) throw data(null, { status: 404 });
  const md = readMarkdown(file)!;
  return { id: `${params.domain}/${params.topic}`, md, file, exercise: await parseExercise(md, file, learnTitle) };
}

export async function loader({ params }: Route.LoaderArgs) {
  const { id, md, file, exercise } = await load(params);
  // The Introduction has one address, the topic's own.
  if (params.lesson === INTRO) throw redirect(`/t/${id}`);
  const index = exercise.lessons.findIndex((l) => l.slug === (params.lesson ?? INTRO));
  if (index < 0) throw data(null, { status: 404 });
  const lesson = exercise.lessons[index];
  recordVisit(id, lesson.slug);
  const topic = inTopic(md, file);
  const learnFile = `learn/${lesson.slug}.md`;
  const learnHtml = lesson.kind === "learn" ? (await renderDoc(untitled(readMarkdown(learnFile) ?? ""), learnFile, topic)).html : "";
  return {
    id,
    exercise: { ...exercise, sections: exercise.sections.filter((s) => lesson.sections.includes(s.slug)) },
    lesson,
    prev: exercise.lessons[index - 1] ?? null,
    next: exercise.lessons[index + 1] ?? null,
    learnHtml,
    state: topicState(id),
    grader: hasGrader(params.domain, params.topic),
  };
}

export const meta = ({ loaderData }: Route.MetaArgs) => [
  { title: loaderData ? `${loaderData.lesson.kind === "intro" ? loaderData.exercise.title : loaderData.lesson.title} · CKA Prep` : "CKA Prep" },
];

// ponytail: one grader run at a time, because runs share the grader's key file on controlplane.
let gradeQueue: Promise<unknown> = Promise.resolve();
function gradeRun(file: string, task: string): Promise<string> {
  const run = gradeQueue.then(() =>
    promisify(execFile)(file, { timeout: 120_000, env: { ...process.env, GRADE_TASK: task } }).then(
      (r) => r.stdout,
      (e) => `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() || String(e.message),
    ),
  );
  gradeQueue = run;
  return run;
}

export async function action({ params, request }: Route.ActionArgs) {
  if (!fromApp(request)) throw data("Forbidden", { status: 403 });
  const { id, exercise } = await load(params);
  const form = await request.formData();
  const str = (k: string) => String(form.get(k) ?? "");
  const practice = exercise.sections.find((s) => s.kind === "practice");
  const run = practiceRunOf(id);
  const now = () => new Date().toISOString();
  switch (str("intent")) {
    case "step":
    case "recall":
      setMark(id, str("intent") as "step" | "recall", str("key"), str("value") || null);
      break;
    case "practice-start": {
      if (practice?.kind !== "practice") throw data(null, { status: 400 });
      if (!exercise.lab) {
        startPracticeRun(id, now());
        break;
      }
      // The lab starts over first; the clock starts when it is running, and the run ends if it fails.
      startPracticeRun(id, null);
      try {
        labController().start(id, exercise.lab, (code) => (code === 0 ? updatePracticeRun(id, { startedAt: now() }) : endPracticeRun(id)));
      } catch (e) {
        endPracticeRun(id);
        if (e instanceof BusyError) return { error: e.message };
        throw e;
      }
      break;
    }
    case "practice-finish":
      if (run?.startedAt && !run.endedAt) updatePracticeRun(id, { endedAt: now() });
      break;
    case "practice-pass":
      if (run) updatePracticeRun(id, { passed: (JSON.parse(str("passed") || "[]") as unknown[]).map(Number) });
      break;
    case "practice-quit":
      endPracticeRun(id);
      break;
    case "attempt": {
      if (practice?.kind !== "practice" || !run?.startedAt || !run.endedAt) throw data(null, { status: 400 });
      // Checked tasks count their scores; when the checks couldn't run, the tasks the learner marked as passed.
      const results = run.results as Record<string, TaskResult | string>;
      const graded = practice.tasks.every((t) => typeof results[t.n] === "object");
      const got = (t: { n: number; weight: number }) => {
        const r = results[t.n];
        if (graded && typeof r === "object") return Math.min(t.weight, Math.max(0, r.score));
        return run.passed.includes(t.n) ? t.weight : 0;
      };
      addAttempt({
        topic: id,
        startedAt: run.startedAt,
        seconds: Math.round((Date.parse(run.endedAt) - Date.parse(run.startedAt)) / 1000),
        budgetSeconds: practice.minutes ? practice.minutes * 60 : null,
        passed: practice.tasks.filter((t) => got(t) >= t.weight).map((t) => t.n),
        score: Math.round(practice.tasks.reduce((a, t) => a + got(t), 0)),
      });
      endPracticeRun(id);
      break;
    }
    case "grade": {
      if (!hasGrader(params.domain, params.topic)) throw data(null, { status: 400 });
      const task = str("task");
      if (!/^\d*$/.test(task)) throw data(null, { status: 400 });
      const out = (await labController().fresh()).owner === id ? await gradeRun(path.join(REPO, id, "grade.sh"), task) : null;
      const results: TaskResult[] = out ? parseGrade(out) : [];
      const error = out === null ? "Start the lab, then check again." : results.length ? null : out || "The check did not run.";
      // A check during a practice exam is kept with it, so a reload shows it.
      if (run?.startedAt) {
        const kept = { ...run.results };
        for (const r of results) kept[r.n] = r;
        if (task) {
          if (error) kept[task] = error;
        } else if (error) kept.all = error;
        else delete kept.all;
        updatePracticeRun(id, { results: kept });
      }
      return error ? { error } : { results };
    }
    default:
      throw data(null, { status: 400 });
  }
  return null;
}

/** The lesson pane's scroll for each history entry, kept for the browser tab, so a reload or Back returns to it. */
const SCROLL = "cka-scroll";
function scrolls(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(SCROLL) ?? "{}");
  } catch {
    return {};
  }
}

export default function Topic({ loaderData }: Route.ComponentProps) {
  const { id, exercise, lesson, prev, next, learnHtml, state, grader } = loaderData;
  const prefs = useRouteLoaderData<typeof rootLoader>("root")!.prefs;
  const running = !!state.run && lesson.kind === "practice";
  const [missedOnly, setMissedOnly] = useState(false);
  useEffect(() => setMissedOnly(false), [id]);
  const check = exercise.sections.find((s) => s.slug === "verification");
  const lab = useLab(id, exercise.lab);
  const popout = usePopout(id);
  // The terminals leave the panel while they have a window of their own, and come back when it closes.
  const popped = popout.popped && lab.status === "running";
  const refs = useReferences(`${id}/${lesson.slug}`, !exercise.lab);
  // The panel beside the lesson, hidden and shown like the sidebar, and shown again when a reference opens.
  const [paneHidden, setPaneHidden] = useState(prefs.pane);
  const togglePane = () => {
    setPaneHidden(!paneHidden);
    setPref("pane", paneHidden ? "shown" : "hidden");
  };
  useEffect(() => {
    if (refs.reference) setPaneHidden(false);
  }, [refs.reference?.key]);

  // The lesson scrolls in its own pane beside the lab, which stays put between lessons, so a new
  // lesson starts at its top (or at the section a link names), and Back or a reload returns to where you were.
  const location = useLocation();
  const navType = useNavigationType();
  useLayoutEffect(() => {
    const pane = document.getElementById("lesson");
    if (!pane) return;
    const saved = scrolls()[location.key];
    const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (navType === "POP" && saved !== undefined) pane.scrollTop = saved;
    else if (target) target.scrollIntoView();
    else pane.scrollTop = 0;
    let t = 0;
    const keep = () => {
      clearTimeout(t);
      t = window.setTimeout(() => {
        try {
          sessionStorage.setItem(SCROLL, JSON.stringify({ ...scrolls(), [location.key]: pane.scrollTop }));
        } catch {}
      }, 150);
    };
    pane.addEventListener("scroll", keep, { passive: true });
    return () => {
      clearTimeout(t);
      pane.removeEventListener("scroll", keep);
    };
  }, [location.key]);

  const body = (
    <article
      key={`${id}/${lesson.slug}`}
      onClick={refs.onClick}
      className="min-w-0"
    >
      {lesson.kind === "intro" && <Markdown html={exercise.introHtml} className="mb-10" />}
      {lesson.kind === "learn" && <Markdown html={learnHtml} className="mb-14" />}
      {exercise.sections.map((s) => {
        if (running && s.kind !== "practice") return null;
        const own = lesson.sections[0] === s.slug && lesson.kind !== "intro";
        switch (s.kind) {
          case "steps":
            return (
              <Section key={s.slug} s={s} hideTitle={own}>
                {s.blocks.map((b, i) =>
                  "html" in b ? (
                    <Markdown key={i} html={b.html} className="mb-6" />
                  ) : (
                    <ol key={i} className="mb-2">
                      {b.steps.map((step, j) => (
                        <Step key={step.key} step={step} done={!!state.steps[step.key]} last={j === b.steps.length - 1} />
                      ))}
                    </ol>
                  ),
                )}
              </Section>
            );
          case "recall": {
            const missedHere = s.items.filter((i) => state.recall[i.key] === "missed").length;
            // Once nothing is missed, the filter goes with its checkbox, so the quiz never shows empty.
            const onlyMissed = missedOnly && missedHere > 0;
            const items = onlyMissed ? s.items.filter((i) => state.recall[i.key] === "missed") : s.items;
            return (
              <Section key={s.slug} s={s} hideTitle={own}>
                {missedHere > 0 && (
                  <div className="mb-4 flex justify-end text-sm text-muted">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input type="checkbox" checked={onlyMissed} onChange={(e) => setMissedOnly(e.target.checked)} />
                      Show missed only ({missedHere})
                    </label>
                  </div>
                )}
                <div className="space-y-3">
                  {items.map((item) => (
                    <RecallCard key={item.key} item={item} grade={state.recall[item.key]} />
                  ))}
                </div>
              </Section>
            );
          }
          case "practice":
            return (
              <Section key={s.slug} s={s} hideTitle={own}>
                <PracticeRun
                  practice={s}
                  checkHtml={check?.kind === "plain" ? check.html : null}
                  attempts={state.attempts}
                  run={state.run}
                  grader={grader}
                  lab={exercise.lab ? lab : undefined}
                />
              </Section>
            );
          default:
            return (
              <Section key={s.slug} s={s}>
                <Markdown html={s.html} />
              </Section>
            );
        }
      })}
    </article>
  );

  const page = (
    <div className="mx-auto max-w-3xl">
      {!running && (
        <header className="mb-8">
          {lesson.kind !== "intro" && (
            <Link to={lessonHref(id, INTRO)} className="text-sm font-semibold text-muted hover:text-accent">
              {exercise.title}
            </Link>
          )}
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{lesson.kind === "intro" ? exercise.title : lesson.title}</h1>
        </header>
      )}
      {body}
      {!running && <Notes key={id} action={`/note/${id}`} body={state.note} />}
      {!running && (
        <nav aria-label="Lessons" className="mt-8 grid grid-cols-2 gap-4">
          {prev ? <LessonLink to={lessonHref(id, prev.slug)} label="‹ Previous" title={prev.title} /> : <span />}
          {next && <LessonLink to={lessonHref(id, next.slug)} label="Next ›" title={next.title} end />}
        </nav>
      )}
    </div>
  );

  if (!exercise.lab && !refs.open) return page;

  // While the terminals have a window of their own, the panel shows only a reference.
  return (
    <>
      <Split
        name={exercise.lab ? "lab" : "doc"}
        left={page}
        right={
          <Pane
            lab={exercise.lab ? lab : undefined}
            terminals={!popped}
            reference={refs.reference}
            onPopOut={popout.open}
            onHide={exercise.lab && !popped ? togglePane : undefined}
          />
        }
        rightHidden={exercise.lab ? (popped ? !refs.open : paneHidden) : false}
        rightSmall={!!exercise.lab && !popped && lab.status !== "running" && !refs.reference}
        place={refs.place}
        label="Resize lesson and lab"
      />
      {exercise.lab && !popped && paneHidden && (
        <button onClick={togglePane} aria-label="Show panel" title="Show panel" className="fixed right-3 top-[4.75rem] z-30 rounded lg:top-3 border border-line bg-surface p-1.5 hover:bg-paper">
          <SidebarIcon flip />
        </button>
      )}
    </>
  );
}

function LessonLink({ to, label, title, end }: { to: string; label: string; title: string; end?: boolean }) {
  return (
    <Link to={to} className={`rounded-md border border-line px-4 py-3 hover:border-accent ${end ? "text-right" : ""}`}>
      <span className="block text-sm text-muted">{label}</span>
      <span className="font-semibold text-accent">{title}</span>
    </Link>
  );
}

function Section({ s, hideTitle, children }: { s: { slug: string; title: string }; hideTitle?: boolean; children: React.ReactNode }) {
  return (
    <section id={s.slug} className="mb-14 scroll-mt-6">
      {!hideTitle && <h2 className="mb-5 border-b border-line pb-2 text-2xl font-bold">{s.title}</h2>}
      {children}
    </section>
  );
}

export { Problem as ErrorBoundary } from "~/root";
