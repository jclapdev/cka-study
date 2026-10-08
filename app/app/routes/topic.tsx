import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { useCallback, useEffect, useRef, useState } from "react";
import { data, Link } from "react-router";
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
import { LabPane, useLab } from "~/components/LabPane";
import { ReferencePanel, referenceHref } from "~/components/ReferencePanel";

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
      const passed = (JSON.parse(str("passed")) as unknown[]).map(Number).filter((n) => practice.tasks.some((t) => t.n === n));
      addAttempt({
        topic: id,
        startedAt: str("startedAt"),
        seconds: Number(str("seconds")),
        budgetSeconds: practice.minutes ? practice.minutes * 60 : null,
        passed,
        score: practice.tasks.filter((t) => passed.includes(t.n)).reduce((a, t) => a + t.weight, 0),
      });
      break;
    }
    case "grade": {
      if (!hasGrader(params.domain, params.topic)) throw data(null, { status: 400 });
      const run = await promisify(execFile)(path.join(REPO, id, "grade.sh"), { timeout: 120_000 }).catch((e) => e);
      return { grade: `${run.stdout ?? ""}${run.stderr ?? ""}`.trim() || String(run.message) };
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
  // The lesson's share of the width (the height below lg) in percent: 0 hides the lesson, 100 hides the lab.
  const grid = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState(50);
  const [popped, setPopped] = useState(false);
  const [wide, setWide] = useState(true);
  // Reference pages opened from the lesson, the last one showing beside it.
  const [refs, setRefs] = useState<string[]>([]);
  useEffect(() => setRefs([]), [id, lesson.slug]);
  const closeRefs = useCallback(() => setRefs([]), []);
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem("split") ?? NaN);
      if (saved >= 0 && saved <= 100) setSplit(saved);
    } catch {}
    const lg = matchMedia("(min-width: 64rem)");
    const onChange = () => setWide(lg.matches);
    onChange();
    lg.addEventListener("change", onChange);
    return () => lg.removeEventListener("change", onChange);
  }, []);
  const keep = (p: number) => {
    try { localStorage.setItem("split", String(p)); } catch {}
    return p;
  };
  const length = () => {
    const r = grid.current!.getBoundingClientRect();
    return { start: wide ? r.left : r.top, total: wide ? r.width : r.height };
  };
  const drag = (e: React.PointerEvent) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const { start, total } = length();
    setSplit(settle((wide ? e.clientX : e.clientY) - start, total));
  };
  const onKey = (e: React.KeyboardEvent) => {
    const { total } = length();
    const min = (Math.min(320, total / 2) / total) * 100;
    const step = { ArrowLeft: -5, ArrowUp: -5, ArrowRight: 5, ArrowDown: 5 }[e.key];
    let p: number;
    if (e.key === "Home") p = 0;
    else if (e.key === "End") p = 100;
    else if (!step) return;
    else if (split === 0 || split === 100) p = split === 0 ? min : 100 - min;
    else p = split + step < min ? 0 : split + step > 100 - min ? 100 : split + step;
    e.preventDefault();
    setSplit(keep(p));
  };
  // The lab pane hides while the terminal has a window of its own, and comes back when it closes.
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

  const body = (
    <article
      key={`${id}/${lesson.slug}`}
      onClick={(e) => {
        const href = referenceHref(e);
        if (!href) return;
        setRefs([href]);
        // A hidden right side comes back for the reference, without saving that width.
        if (split === 100) setSplit(50);
      }}
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

      {!running && (
        <nav aria-label="Lessons" className="mt-14 flex flex-wrap justify-between gap-4 border-t border-line pt-6">
          {prev ? (
            <Link to={lessonHref(id, prev.slug)} className="rounded border border-line px-4 py-2 hover:border-accent">
              <span className="block text-xs text-muted">Previous</span>
              {prev.title}
            </Link>
          ) : <span />}
          {next && (
            <Link to={lessonHref(id, next.slug)} className="ml-auto rounded bg-accent px-4 py-2 text-right font-semibold text-paper hover:opacity-90">
              <span className="block text-xs font-normal">Next</span>
              {next.title}
            </Link>
          )}
        </nav>
      )}
      {!running && <Notes key={id} body={state.note} />}
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

  if (!exercise.lab && !refs.length) return page;

  // The lesson on the left and the lab on the right, each filling the screen beside the topic list
  // (17rem, from root.tsx, unless hidden) and scrolling on its own. Below lg the lab is the bottom part.
  // The divider between them drags; a side dragged to the edge is hidden but stays mounted, so the
  // terminal keeps its session. The lesson pane keeps main's padding, which the practice exam's sticky
  // clock bar relies on. While the terminal has a window of its own the lab pane hides.
  const shown = popped && !refs.length ? 100 : split;
  const tracks = `minmax(0,${shown}fr) minmax(0,${100 - shown}fr)`;
  const gone = "invisible overflow-hidden p-0!";
  return (
    <div
      ref={grid}
      style={{ "--tracks": tracks } as React.CSSProperties}
      className="fixed inset-0 z-20 grid grid-rows-(--tracks) bg-paper lg:left-[17rem] lg:grid-cols-(--tracks) lg:grid-rows-1 lg:group-data-[sidebar=hidden]/app:left-0"
    >
      <div id="lesson" className={`min-h-0 overflow-y-auto px-4 py-8 sm:px-10 ${shown === 0 ? gone : ""}`}>{page}</div>
      <div className={`relative min-h-0 border-t border-line lg:border-l lg:border-t-0 ${shown === 100 ? "border-0" : ""}`}>
        <div className={`h-full ${shown === 100 ? gone : ""}`}>
          {exercise.lab && <LabPane lab={lab} onPopOut={popOut} />}
        </div>
        {refs.length > 0 && (
          <ReferencePanel refs={refs} onOpen={(h) => setRefs([...refs, h])} onBack={() => setRefs(refs.slice(0, -1))} onClose={closeRefs} />
        )}
        {(!popped || refs.length > 0) && (
          <div
            role="separator"
            tabIndex={0}
            aria-label="Resize lesson and lab"
            aria-controls="lesson"
            aria-orientation={wide ? "vertical" : "horizontal"}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(split)}
            aria-valuetext={split === 0 ? "Lesson hidden" : split === 100 ? "Lab hidden" : `Lesson ${Math.round(split)}%`}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={drag}
            onLostPointerCapture={() => setSplit(keep)}
            onDoubleClick={() => setSplit(keep(50))}
            onKeyDown={onKey}
            className={`group absolute inset-x-0 top-0 z-30 flex h-2 cursor-row-resize touch-none items-center justify-center outline-none lg:inset-x-auto lg:inset-y-0 lg:left-0 lg:h-auto lg:w-2 lg:cursor-col-resize ${
              shown === 100 ? "-translate-y-full lg:translate-y-0 lg:-translate-x-full" : ""
            }`}
          >
            <span className="h-1 w-10 rounded-full bg-line group-hover:bg-accent group-focus-visible:bg-accent group-focus-visible:ring-2 group-focus-visible:ring-accent lg:h-10 lg:w-1" />
          </div>
        )}
      </div>
    </div>
  );
}

/** Where the divider lands for a pointer px into a total-px pane: each side is hidden (0 or 100) or at least 320px. */
function settle(px: number, total: number) {
  const min = Math.min(320, total / 2);
  if (px < min / 2) return 0;
  if (px > total - min / 2) return 100;
  return (Math.min(Math.max(px, min), total - min) / total) * 100;
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
