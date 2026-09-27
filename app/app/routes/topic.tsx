import { useCallback, useState } from "react";
import { data } from "react-router";
import type { Route } from "./+types/topic";
import { parseExercise } from "~/content/parse";
import { readMarkdown, topicReadme } from "~/content/repo";
import { addAttempt, setMark, setNote, topicState } from "~/db/progress";
import { Markdown } from "~/components/Markdown";
import { Notes } from "~/components/Notes";
import { PracticeRun } from "~/components/PracticeRun";
import { RecallCard } from "~/components/RecallCard";
import { Step } from "~/components/Step";

async function load(params: Route.LoaderArgs["params"]) {
  const file = topicReadme(params.domain, params.topic);
  if (!file) throw data(null, { status: 404 });
  return { id: `${params.domain}/${params.topic}`, exercise: await parseExercise(readMarkdown(file)!, file) };
}

export async function loader({ params }: Route.LoaderArgs) {
  const { id, exercise } = await load(params);
  return { id, exercise, state: topicState(id) };
}

export const meta = ({ loaderData }: Route.MetaArgs) => [{ title: `${loaderData?.exercise.title ?? "Topic"} · CKA study` }];

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
      if (practice?.kind !== "practice") throw data("No Practice it section", { status: 400 });
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
    default:
      throw data("Unknown intent", { status: 400 });
  }
  return null;
}

export default function Topic({ loaderData }: Route.ComponentProps) {
  const { id, exercise, state } = loaderData;
  const [running, setRunning] = useState(false);
  const [missedOnly, setMissedOnly] = useState(false);
  const onRunning = useCallback((r: boolean) => setRunning(r), []);
  const check = exercise.sections.find((s) => s.slug === "check-your-work");

  return (
    <article key={id} className="mx-auto max-w-3xl">
      {!running && (
        <header className="mb-10">
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{exercise.title}</h1>
          <Markdown html={exercise.introHtml} className="mt-4" />
        </header>
      )}

      {exercise.sections.map((s) => {
        if (running && s.kind !== "practice") return null;
        switch (s.kind) {
          case "steps":
            return (
              <Section key={s.slug} s={s}>
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
              <Section key={s.slug} s={s}>
                <div className="mb-4 flex items-center justify-between text-sm text-muted">
                  <span>Answer each one in your head before you open it.</span>
                  {missed > 0 && (
                    <label className="flex cursor-pointer items-center gap-2">
                      <input type="checkbox" checked={missedOnly} onChange={(e) => setMissedOnly(e.target.checked)} />
                      Only the {missed} I missed
                    </label>
                  )}
                </div>
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
              <Section key={s.slug} s={s} hideTitle={running}>
                <PracticeRun
                  practice={s}
                  checkHtml={check?.kind === "plain" ? check.html : null}
                  attempts={state.attempts}
                  onRunning={onRunning}
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
    </article>
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
