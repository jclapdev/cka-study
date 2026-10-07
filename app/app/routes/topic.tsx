import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { useCallback, useState } from "react";
import { data, Link, useSearchParams } from "react-router";
import type { Route } from "./+types/topic";
import { INTRO, lessonHref } from "~/content/links";
import { inTopic, mdSection, parseExercise, renderDoc, untitled } from "~/content/parse";
import { hasGrader, learnTitle, readMarkdown, REPO, topicReadme } from "~/content/repo";
import { addAttempt, setMark, setNote, topicState } from "~/db/progress";
import { Markdown } from "~/components/Markdown";
import { Notes } from "~/components/Notes";
import { PracticeRun } from "~/components/PracticeRun";
import { PrepareLab } from "~/components/PrepareLab";
import { RecallCard } from "~/components/RecallCard";
import { Step } from "~/components/Step";
import { Terminal } from "~/components/Terminal";

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
  const labFile = `lab/labs/${exercise.lab}/README.md`;
  const lab = exercise.lab ? readMarkdown(labFile) : null;
  const labHtml = lab ? (await renderDoc(untitled(lab), labFile, topic)).html : "";
  const machinesHtml = (await renderDoc(mdSection(readMarkdown("lab/README.md")!, "Machines"), "lab/README.md", topic)).html;
  return {
    id,
    exercise: { ...exercise, sections: exercise.sections.filter((s) => lesson.sections.includes(s.slug)) },
    lesson,
    prev: exercise.lessons[index - 1] ?? null,
    next: exercise.lessons[index + 1] ?? null,
    learnHtml,
    state: topicState(id),
    labHtml,
    machinesHtml,
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
  const { id, exercise, lesson, prev, next, learnHtml, state, labHtml, machinesHtml, grader } = loaderData;
  const [params] = useSearchParams();
  const [running, setRunning] = useState(false);
  const [term, setTerm] = useState(() => params.get("terminal") === "1");
  const [missedOnly, setMissedOnly] = useState(false);
  const onRunning = useCallback((r: boolean) => setRunning(r), []);
  const check = exercise.sections.find((s) => s.slug === "check-your-work");

  const openTerminal = (
    <button onClick={() => setTerm(true)} className="rounded border border-line px-3 py-1.5 text-sm font-semibold hover:border-accent">
      Open terminal
    </button>
  );

  const body = (
    <article key={`${id}/${lesson.slug}`} className="min-w-0">
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
                  terminalButton={term ? null : openTerminal}
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

  // Hidden rather than removed while a practice exam runs, so a lab being prepared keeps its output.
  const lab = (
    <aside
      id="lab"
      aria-label="Lab"
      hidden={running}
      className={`mt-14 scroll-mt-6 space-y-3 ${term ? "" : "xl:sticky xl:top-6 xl:mt-0 xl:max-h-[calc(100dvh-3rem)] xl:self-start xl:overflow-y-auto"}`}
    >
      <h2 className="text-lg font-bold">Lab</h2>
      {exercise.lab ? (
        <>
          <Markdown html={labHtml} className="text-sm" />
          <PrepareLab lab={exercise.lab} terminal={term ? null : () => setTerm(true)} />
          {!term && <div>{openTerminal}</div>}
        </>
      ) : (
        <p className="text-muted">This topic has no lab.</p>
      )}
      <details className="rounded-md border border-line px-4 py-2">
        <summary className="cursor-pointer text-sm font-semibold">Machines</summary>
        <Markdown html={machinesHtml} className="mt-3 text-sm" />
      </details>
    </aside>
  );

  const page = (
    <div className={`mx-auto ${term ? "max-w-3xl" : "max-w-3xl xl:max-w-6xl"}`}>
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
      <div className={term ? "" : "xl:grid xl:grid-cols-[minmax(0,1fr)_18rem] xl:gap-12"}>
        {body}
        {lab}
      </div>
    </div>
  );

  // With the terminal open, a workspace like the exam's: the page on the left and the terminal on
  // the right, each filling the screen beside the topic list (17rem, from root.tsx) and scrolling
  // on its own. Below lg the terminal takes the bottom half. The page pane keeps main's padding,
  // which the practice exam's sticky clock bar relies on. The elements stay the same either way, so
  // opening or hiding the terminal never resets a practice exam.
  return (
    <div className={term ? "fixed inset-0 z-20 grid grid-rows-2 bg-paper lg:left-[17rem] lg:grid-cols-2 lg:grid-rows-1" : ""}>
      <div className={term ? "min-h-0 overflow-y-auto px-4 py-8 sm:px-10" : ""}>{page}</div>
      {term && (
        <div className="min-h-0 border-t border-line lg:border-l lg:border-t-0">
          <Terminal onHide={() => setTerm(false)} />
        </div>
      )}
    </div>
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
