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
import { useReferences } from "~/components/ReferencePanel";
import { labState } from "~/lab/state.server";
import { Split } from "~/components/Split";

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
      const now = await labState();
      if (now.status !== "running" || now.lab !== exercise.lab) return { grade: "Start the lab, then check again." };
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
  const [popped, setPopped] = useState(false);
  const refs = useReferences(`${id}/${lesson.slug}`, !exercise.lab);
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

  if (!exercise.lab && !refs.open) return page;

  // While the terminal has a window of its own the lab pane hides.
  return (
    <Split
      left={page}
      right={<>{exercise.lab && <LabPane lab={lab} onPopOut={popOut} />}{refs.panel}</>}
      rightHidden={popped && !refs.open}
      reveal={refs.open}
      place={refs.place}
      label="Resize lesson and lab"
    />
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
