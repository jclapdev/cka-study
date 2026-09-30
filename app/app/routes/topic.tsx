import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { useCallback, useState } from "react";
import { data, Link, useSearchParams } from "react-router";
import type { Route } from "./+types/topic";
import { labSection, parseExercise, referenceCovers, referenceLinks, renderDoc } from "~/content/parse";
import { hasGrader, listReferences, readMarkdown, REPO, topicReadme } from "~/content/repo";
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
  return { id: `${params.domain}/${params.topic}`, exercise: await parseExercise(readMarkdown(file)!, file) };
}

export async function loader({ params }: Route.LoaderArgs) {
  const { id, exercise } = await load(params);
  const md = readMarkdown(topicReadme(params.domain, params.topic)!)!;
  const lab = exercise.lab ? labSection(readMarkdown("lab/README.md")!, exercise.lab) : "";
  const labHtml = lab ? (await renderDoc(lab, "lab/README.md")).html : "";
  // Every reference is loaded, so a link from one reference to another still opens in this tab.
  const covers = referenceCovers(readMarkdown("references/README.md") ?? "");
  const references = await Promise.all(
    listReferences().map(async (f) => {
      const name = f.replace(/^references\/|\.md$/g, "");
      return { name, covers: covers[name] ?? "", ...(await renderDoc(readMarkdown(f)!, f, true)) };
    }),
  );
  const mine = referenceLinks(md).map((f) => f.replace(/^references\/|\.md$/g, ""));
  return { id, exercise, state: topicState(id), labHtml, references, mine, grader: hasGrader(params.domain, params.topic) };
}

export const meta = ({ loaderData }: Route.MetaArgs) => [{ title: `${loaderData?.exercise.title ?? "Topic"} · CKA Prep` }];

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
      if (practice?.kind !== "practice") throw data("No Practice section", { status: 400 });
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
      if (!hasGrader(params.domain, params.topic)) throw data("No grade.sh", { status: 400 });
      const run = await promisify(execFile)(path.join(REPO, id, "grade.sh"), { timeout: 120_000 }).catch((e) => e);
      return { grade: `${run.stdout ?? ""}${run.stderr ?? ""}`.trim() || String(run.message) };
    }
    default:
      throw data("Unknown intent", { status: 400 });
  }
  return null;
}

export default function Topic({ loaderData }: Route.ComponentProps) {
  const { id, exercise, state, labHtml, references, mine, grader } = loaderData;
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.key === params.get("tab")) ?? TABS[1]).key;
  const [running, setRunning] = useState(false);
  const [term, setTerm] = useState(false);
  const [missedOnly, setMissedOnly] = useState(false);
  const onRunning = useCallback((r: boolean) => setRunning(r), []);
  const check = exercise.sections.find((s) => s.slug === "check-your-work");

  const openTerminal = (
    <button onClick={() => setTerm(true)} className="rounded border border-line px-3 py-1.5 text-sm font-semibold hover:border-accent">
      Open terminal
    </button>
  );

  const article = (
    <article key={id} className={`mx-auto ${tab === "references" && !running ? "max-w-5xl" : "max-w-3xl"}`}>
      {!running && (
        <header className="mb-10">
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{exercise.title}</h1>
          <Markdown html={exercise.introHtml} className="mt-4" />
          <div role="tablist" className="mt-8 flex flex-wrap gap-2 border-b border-line">
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setParams(t.key === "exercise" ? {} : { tab: t.key }, { replace: true, preventScrollReset: true })}
                className={`-mb-px border-b-2 px-4 py-2 font-semibold ${
                  tab === t.key ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
            {!term && <div className="mb-1 ml-auto">{openTerminal}</div>}
          </div>
        </header>
      )}

      {/* Hidden rather than removed on other tabs, so a lab being prepared keeps showing its output. */}
      <section className="mb-14" hidden={tab !== "lab" || running}>
        {exercise.lab && <PrepareLab state={exercise.lab} onOpenTerminal={() => setTerm(true)} />}
        {labHtml ? (
          <Markdown html={labHtml} />
        ) : (
          <p className="text-muted">This topic has no lab.</p>
        )}
      </section>

      {tab === "references" && !running && <References references={references} mine={mine} />}

      {(tab === "exercise" || running) && exercise.sections.map((s) => {
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
              <Section key={s.slug} s={s} hideTitle={running}>
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

      {tab === "exercise" && !running && <Notes key={id} body={state.note} />}
    </article>
  );

  // With the terminal open, a workspace like the exam's: the page on the left and the terminal on
  // the right, each filling the screen beside the topic list (17rem, from root.tsx) and scrolling
  // on its own. Below lg the terminal takes the bottom half. The page pane keeps main's padding,
  // which the practice exam's sticky clock bar relies on. The elements stay the same either way, so
  // opening or hiding the terminal never resets a practice exam.
  return (
    <div className={term ? "fixed inset-0 z-20 grid grid-rows-2 bg-paper lg:left-[17rem] lg:grid-cols-2 lg:grid-rows-1" : ""}>
      <div className={term ? "min-h-0 overflow-y-auto px-4 py-8 sm:px-10" : ""}>{article}</div>
      {term && (
        <div className="min-h-0 border-t border-line lg:border-l lg:border-t-0">
          <Terminal onHide={() => setTerm(false)} />
        </div>
      )}
    </div>
  );
}

type Reference = { name: string; covers: string; title: string; headings: { id: string; text: string }[]; html: string };

/** A list of this topic's references beside the one selected, which `?ref=` names. */
function References({ references, mine }: { references: Reference[]; mine: string[] }) {
  const [params] = useSearchParams();
  const selected = references.find((r) => r.name === params.get("ref")) ?? references.find((r) => r.name === mine[0]);
  if (!selected) return <p className="text-muted">This topic has no references.</p>;
  const listed = mine.includes(selected.name) ? mine : [...mine, selected.name];
  return (
    <div className="mb-14 md:grid md:grid-cols-[14rem_1fr] md:gap-10">
      <nav
        aria-label="References for this topic"
        className="mb-8 md:sticky md:top-6 md:mb-0 md:max-h-[calc(100vh-3rem)] md:self-start md:overflow-y-auto"
      >
        <ul className="space-y-1">
          {listed.map((name) => {
            const r = references.find((x) => x.name === name);
            if (!r) return null;
            return (
              <li key={name}>
                <Link
                  to={`?tab=references&ref=${name}`}
                  replace
                  aria-current={r === selected ? "page" : undefined}
                  className={`block rounded px-3 py-2 hover:bg-surface ${r === selected ? "bg-surface font-semibold" : ""}`}
                >
                  {r.title}
                  {r.covers && <span className="block text-xs font-normal text-muted">{r.covers}</span>}
                </Link>
                {r === selected && r.headings.length > 0 && (
                  <ul aria-label="On this page" className="mb-2 ml-3 mt-1 space-y-1 border-l border-line pl-3 text-sm">
                    {r.headings.map((h) => (
                      <li key={h.id}>
                        <a href={`#${h.id}`} className="block text-accent hover:underline">
                          {h.text}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="min-w-0">
        <Markdown key={selected.name} html={selected.html} />
      </div>
    </div>
  );
}

const TABS = [
  { key: "lab", label: "Lab" },
  { key: "exercise", label: "Exercise" },
  { key: "references", label: "References" },
] as const;

function Section({ s, hideTitle, children }: { s: { slug: string; title: string }; hideTitle?: boolean; children: React.ReactNode }) {
  return (
    <section id={s.slug} className="mb-14 scroll-mt-6">
      {!hideTitle && <h2 className="mb-5 border-b border-line pb-2 text-2xl font-bold">{s.title}</h2>}
      {children}
    </section>
  );
}
