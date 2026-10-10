import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { data, Link, useLocation, useNavigationType } from "react-router";
import type { Route } from "./+types/topic";
import { INTRO, lessonHref } from "~/content/links";
import { inTopic, parseExercise, renderDoc, untitled } from "~/content/parse";
import { hasGrader, learnTitle, readMarkdown, REPO, topicReadme } from "~/content/repo";
import { addAttempt, setMark, setNote, topicState } from "~/db/progress";
import { Markdown } from "~/components/Markdown";
import { Notes } from "~/components/Notes";
import { PracticeRun } from "~/components/PracticeRun";
import { RecallCard } from "~/components/RecallCard";
import { Step } from "~/components/Step";
import { useLab } from "~/components/LabPane";
import { Pane } from "~/components/Pane";
import { useReferences } from "~/components/ReferencePanel";
import { labState } from "~/lab/state.server";
import { parseGrade, type TaskResult } from "~/lab/grade";
import { Split } from "~/components/Split";
import { SidebarIcon } from "~/root";

async function load(params: Route.LoaderArgs["params"]) {
  const file = topicReadme(params.domain, params.topic);
  if (!file) throw data(null, { status: 404 });
  const md = readMarkdown(file)!;
  return { id: `${params.domain}/${params.topic}`, md, file, exercise: await parseExercise(md, file, learnTitle) };
}

export async function loader({ params }: Route.LoaderArgs) {
  const { id, md, file, exercise } = await load(params);
  const index = exercise.lessons.findIndex((l) => l.slug === (params.lesson ?? INTRO));
  if (index < 0) throw data(null, { status: 404 });
  const lesson = exercise.lessons[index];
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
  const { id, exercise } = await load(params);
  const form = await request.formData();
  const str = (k: string) => String(form.get(k) ?? "");
  switch (str("intent")) {
    case "step":
    case "recall":
      setMark(id, str("intent") as "step" | "recall", str("key"), str("value") || null);
      break;
    case "note":
      setNote(id, str("body"));
      break;
    case "attempt": {
      const practice = exercise.sections.find((s) => s.kind === "practice");
      if (practice?.kind !== "practice") throw data(null, { status: 400 });
      // Checked tasks send their scores; without a grader the learner marks the tasks they passed.
      const passedList = (JSON.parse(str("passed") || "[]") as unknown[]).map(Number);
      const scores = JSON.parse(str("scores") || "{}") as Record<string, unknown>;
      const got = (t: { n: number; weight: number }) =>
        str("scores") ? Math.min(t.weight, Math.max(0, Number(scores[t.n]) || 0)) : passedList.includes(t.n) ? t.weight : 0;
      addAttempt({
        topic: id,
        startedAt: str("startedAt"),
        seconds: Number(str("seconds")),
        budgetSeconds: practice.minutes ? practice.minutes * 60 : null,
        passed: practice.tasks.filter((t) => got(t) >= t.weight).map((t) => t.n),
        score: Math.round(practice.tasks.reduce((a, t) => a + got(t), 0)),
      });
      break;
    }
    case "grade": {
      if (!hasGrader(params.domain, params.topic)) throw data(null, { status: 400 });
      const now = await labState();
      if (now.status !== "running" || now.lab !== exercise.lab) return { error: "Start the lab, then check again." };
      const task = str("task");
      if (!/^\d*$/.test(task)) throw data(null, { status: 400 });
      const out = await gradeRun(path.join(REPO, id, "grade.sh"), task);
      const results: TaskResult[] = parseGrade(out);
      return results.length ? { results } : { error: out || "The check did not run." };
    }
    default:
      throw data(null, { status: 400 });
  }
  return null;
}

export default function Topic({ loaderData }: Route.ComponentProps) {
  const { id, exercise, lesson, prev, next, learnHtml, state, grader } = loaderData;
  const [running, setRunning] = useState(false);
  const [missedOnly, setMissedOnly] = useState(false);
  const onRunning = useCallback((r: boolean) => setRunning(r), []);
  const check = exercise.sections.find((s) => s.slug === "check-your-work");
  const lab = useLab(exercise.lab);
  const [popped, setPopped] = useState(false);
  const refs = useReferences(`${id}/${lesson.slug}`, !exercise.lab);
  // The panel beside the lesson, hidden and shown like the sidebar, and shown again when a reference opens.
  const [paneHidden, setPaneHidden] = useState(false);
  useEffect(() => {
    try { setPaneHidden(localStorage.getItem("pane") === "hidden"); } catch {}
  }, []);
  const togglePane = () => {
    setPaneHidden(!paneHidden);
    try { localStorage.setItem("pane", paneHidden ? "shown" : "hidden"); } catch {}
  };
  useEffect(() => {
    if (refs.reference) setPaneHidden(false);
  }, [refs.reference?.key]);
  // The terminals leave the panel while they have a window of their own, and come back when it closes.
  const popup = useRef<{ win: Window; timer: number } | null>(null);
  useEffect(() => () => clearInterval(popup.current?.timer), []);
  const popOut = () => {
    const win = window.open("/terminal", "cka-terminal", "popup,width=960,height=640");
    if (!win) return;
    clearInterval(popup.current?.timer);
    const timer = window.setInterval(() => {
      if (!win.closed) return;
      clearInterval(timer);
      popup.current = null;
      setPopped(false);
    }, 1000);
    popup.current = { win, timer };
    setPopped(true);
  };

  // The lesson scrolls in its own pane beside the lab, which stays put between lessons, so a new
  // lesson starts at its top (or at the section a link names), and Back returns to where you were.
  const location = useLocation();
  const navType = useNavigationType();
  useLayoutEffect(() => {
    const pane = document.getElementById("lesson");
    if (!pane) return;
    const saved = paneScroll.get(location.key);
    const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (navType === "POP" && saved !== undefined) pane.scrollTop = saved;
    else if (target) target.scrollIntoView();
    else pane.scrollTop = 0;
    const keep = () => paneScroll.set(location.key, pane.scrollTop);
    pane.addEventListener("scroll", keep, { passive: true });
    return () => pane.removeEventListener("scroll", keep);
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
            const missed = s.items.filter((i) => state.recall[i.key] === "missed").length;
            const items = missedOnly ? s.items.filter((i) => state.recall[i.key] === "missed") : s.items;
            return (
              <Section key={s.slug} s={s} hideTitle={own}>
                {missed > 0 && (
                  <div className="mb-4 flex justify-end text-sm text-muted">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input type="checkbox" checked={missedOnly} onChange={(e) => setMissedOnly(e.target.checked)} />
                      Show missed only ({missed})
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
                  grader={grader}
                  onRunning={onRunning}
                  onStart={exercise.lab ? lab.start : undefined}
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

      {!running && <Notes key={id} body={state.note} />}
      {!running && (
        <nav aria-label="Lessons" className="mt-8 grid grid-cols-2 gap-4">
          {prev ? <LessonLink to={lessonHref(id, prev.slug)} label="‹ Previous" title={prev.title} /> : <span />}
          {next && <LessonLink to={lessonHref(id, next.slug)} label="Next ›" title={next.title} end />}
        </nav>
      )}
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
    </div>
  );

  if (!exercise.lab && !refs.open) return page;

  // While the terminals have a window of their own, the panel shows only a reference.
  return (
    <>
      <Split
        left={page}
        right={
          <Pane
            lab={exercise.lab ? lab : undefined}
            terminals={!popped}
            reference={refs.reference}
            onPopOut={popOut}
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

const paneScroll = new Map<string, number>();

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
