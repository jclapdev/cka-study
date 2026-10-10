import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import type { Section, Task } from "~/content/parse";
import type { TaskResult } from "~/lab/grade";
import { useConfirm } from "./Confirm";
import { Markdown } from "./Markdown";

type Practice = Extract<Section, { kind: "practice" }>;
type Graded = { results?: TaskResult[]; error?: string };
type Results = Record<number, TaskResult | string>; // a string is why the check could not run

type Attempt = { id: number; startedAt: string; seconds: number; budgetSeconds: number | null; score: number };

const PASS_MARK = 66;

const clock = (s: number) => {
  const a = Math.abs(s);
  return `${s < 0 ? "−" : ""}${Math.floor(a / 60)}:${String(a % 60).padStart(2, "0")}`;
};

export function PracticeRun({
  practice,
  checkHtml,
  attempts,
  onRunning,
  grader,
  onStart,
}: {
  practice: Practice;
  checkHtml: string | null;
  attempts: Attempt[];
  onRunning: (running: boolean) => void;
  grader: boolean;
  /** Resets the lab, so each run starts clean. */
  onStart?: () => void;
}) {
  const fetcher = useFetcher();
  const grading = useFetcher<Graded>();
  const [results, setResults] = useState<Results>({});
  // True from Finish or Check again until that check returns, so no score shows before it.
  const [pending, setPending] = useState(false);
  const checkAll = () => {
    setPending(true);
    grading.submit({ intent: "grade" }, { method: "post" });
  };
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [endedAt, setEndedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [passed, setPassed] = useState<number[]>([]);
  const budget = practice.minutes ? practice.minutes * 60 : null;

  useEffect(() => {
    if (!startedAt || endedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt, endedAt]);

  useEffect(() => onRunning(startedAt !== null), [startedAt, onRunning]);

  const [ask, dialog] = useConfirm();
  const start = async () => {
    if (onStart && !(await ask("Start the practice exam? The lab starts over, and your work in it is lost.", "Start"))) return;
    onStart?.();
    setStartedAt(Date.now());
    setNow(Date.now());
    setEndedAt(null);
    setPassed([]);
    setResults({});
    setPending(false);
    document.querySelector("article")?.scrollIntoView(); // the page, or its pane beside the terminal
  };
  const reset = () => {
    setStartedAt(null);
    setEndedAt(null);
  };

  const elapsed = startedAt ? Math.round(((endedAt ?? now) - startedAt) / 1000) : 0;
  const onResult = (n: number | null, g: Graded) =>
    setResults((r) => {
      const next = { ...r };
      for (const t of g.results ?? []) next[t.n] = t;
      if (!g.results && n !== null) next[n] = g.error || "The check did not run.";
      return next;
    });
  // Finish checks every task; the learner marks tasks by hand only when there is no grader or it could not run.
  useEffect(() => {
    if (grading.state !== "idle" || !pending) return;
    if (grading.data) onResult(null, grading.data);
    setPending(false);
  }, [grading.state]);
  const graded = grader && practice.tasks.every((t) => typeof results[t.n] === "object");
  const checking = pending;
  const manual = !grader || (!checking && !!grading.data?.error);
  const scoreOf = (t: Task) => {
    const r = results[t.n];
    return graded && typeof r === "object" ? r.score : passed.includes(t.n) ? t.weight : 0;
  };
  const score = Math.round(practice.tasks.reduce((a, t) => a + scoreOf(t), 0));

  const save = () => {
    fetcher.submit(
      {
        intent: "attempt",
        startedAt: new Date(startedAt!).toISOString(),
        seconds: String(elapsed),
        ...(graded
          ? { scores: JSON.stringify(Object.fromEntries(practice.tasks.map((t) => [t.n, scoreOf(t)]))) }
          : { passed: JSON.stringify(passed) }),
      },
      { method: "post" },
    );
    reset();
  };

  // Not running: the tasks, a start button, the solution and past attempts.
  if (!startedAt)
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-line bg-surface px-5 py-4">
          <p>
            {practice.tasks.length} tasks
            {practice.minutes && <>, {practice.minutes} minutes</>}.
          </p>
          <button onClick={start} className="rounded bg-accent px-4 py-2 font-semibold text-paper hover:opacity-90">
            Start practice exam
          </button>
        </div>
        <Markdown html={practice.introHtml} />
        <Tasks tasks={practice.tasks} />
        {practice.solutionHtml && (
          <details className="rounded-md border border-line bg-surface">
            <summary className="cursor-pointer px-5 py-3 font-semibold">Solution</summary>
            <Markdown html={practice.solutionHtml} className="border-t border-line px-5 py-4" />
          </details>
        )}
        {attempts.length > 0 && <History attempts={attempts} />}
        {dialog}
      </div>
    );

  const remaining = budget !== null ? budget - elapsed : null;
  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-4 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur sm:-mx-10 sm:px-10">
        <div>
          <span
            className={`font-mono text-3xl font-semibold tabular-nums ${remaining !== null && remaining < 0 ? "text-missed" : ""}`}
            role="timer"
          >
            {remaining !== null ? clock(remaining) : clock(elapsed)}
          </span>
          <span className="ml-3 text-sm text-muted">
            {remaining === null ? "elapsed" : remaining < 0 ? "over time" : "left"}
          </span>
        </div>
        <div className="flex gap-2">
          <button onClick={reset} className="rounded border border-line px-3 py-2 text-sm hover:border-accent">
            Quit
          </button>
          {!endedAt && (
            <button
              onClick={() => {
                setEndedAt(Date.now());
                if (grader) checkAll();
              }}
              className="rounded bg-accent px-4 py-2 font-semibold text-paper">
              Finish
            </button>
          )}
        </div>
      </div>

      {!endedAt ? (
        <>
          <Markdown html={practice.introHtml} />
          <Tasks tasks={practice.tasks} results={results} onResult={grader ? onResult : undefined} />
        </>
      ) : (
        <>
          <p>
            You took {clock(elapsed)}.{" "}
            {checking ? "Checking each task…" : manual ? "Mark each task you passed." : null}
          </p>
          {grader && manual && grading.data?.error && (
            <div className="flex flex-wrap items-center gap-4 rounded-md border border-missed px-5 py-3">
              <p className="text-missed">{grading.data.error}</p>
              <button
                onClick={checkAll}
                className="ml-auto rounded border border-line px-3 py-1.5 text-sm font-semibold hover:border-accent"
              >
                Check again
              </button>
            </div>
          )}
          {manual ? (
            <Tasks tasks={practice.tasks} passed={passed} onToggle={(n) => setPassed((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]))} />
          ) : (
            <Tasks tasks={practice.tasks} results={results} />
          )}
          <div className="flex flex-wrap items-center gap-4 rounded-md border border-line bg-surface px-5 py-4">
            <p className="text-lg">
              Score <strong className={score >= PASS_MARK ? "text-done" : "text-missed"}>{checking ? "…" : `${score}%`}</strong>
              <span className="ml-2 text-sm text-muted">pass mark {PASS_MARK}%</span>
            </p>
            <button onClick={save} disabled={checking} className="ml-auto rounded bg-accent px-4 py-2 font-semibold text-paper disabled:opacity-60">
              Save score
            </button>
          </div>
          {checkHtml && (
            <section>
              <h3 className="mb-3 text-lg font-bold">Check your work</h3>
              <Markdown html={checkHtml} />
            </section>
          )}
          {practice.solutionHtml && (
            <details className="rounded-md border border-line bg-surface">
              <summary className="cursor-pointer px-5 py-3 font-semibold">Solution</summary>
              <Markdown html={practice.solutionHtml} className="border-t border-line px-5 py-4" />
            </details>
          )}
        </>
      )}
    </div>
  );
}

function Tasks({
  tasks,
  passed,
  onToggle,
  results = {},
  onResult,
}: {
  tasks: Task[];
  passed?: number[];
  onToggle?: (n: number) => void;
  results?: Results;
  onResult?: (n: number, g: Graded) => void;
}) {
  return (
    <ol className="space-y-3">
      {tasks.map((t) => {
        const r = results[t.n];
        const full = typeof r === "object" && r.score >= r.weight;
        return (
          <li
            key={t.n}
            className={`rounded-md border bg-surface px-5 py-4 ${typeof r === "object" ? (full ? "border-done" : "border-missed") : "border-line"}`}
          >
            <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {onToggle ? (
                <label className="flex cursor-pointer items-center gap-2 font-semibold">
                  <input type="checkbox" checked={passed!.includes(t.n)} onChange={() => onToggle(t.n)} className="size-4 accent-done" />
                  Task {t.n}
                </label>
              ) : (
                <span className="font-semibold">Task {t.n}</span>
              )}
              <span className="text-muted">
                on <span className="font-mono text-ink">{t.hosts.join(", ")}</span>
              </span>
              <span className="ml-auto flex items-center gap-3">
                {onResult && <CheckTask n={t.n} onResult={onResult} />}
                {typeof r === "object" ? (
                  <span className={`font-semibold ${full ? "text-done" : "text-missed"}`}>
                    {full ? "✓" : "✗"} {+r.score.toFixed(1)} of {t.weight}%
                  </span>
                ) : (
                  <span className="font-semibold">{t.weight}%</span>
                )}
              </span>
            </div>
            <Markdown html={t.html} />
            {typeof r === "object" && (
              <ul className="mt-3 space-y-0.5 text-sm">
                {r.checks.map((c, i) => (
                  <li key={i} className={c.ok ? "text-done" : "text-missed"}>
                    {c.ok ? "✓" : "✗"} {c.what}
                  </li>
                ))}
              </ul>
            )}
            {typeof r === "string" && <p className="mt-3 text-sm text-missed">{r}</p>}
            {t.hintHtml && (
              <details className="mt-3 rounded border border-line">
                <summary className="cursor-pointer px-3 py-1.5 text-sm font-semibold">Hint</summary>
                <Markdown html={t.hintHtml} className="border-t border-line px-3 py-2" />
              </details>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Runs one task's checks and marks it. */
function CheckTask({ n, onResult }: { n: number; onResult: (n: number, g: Graded) => void }) {
  const f = useFetcher<Graded>();
  useEffect(() => {
    if (f.state === "idle" && f.data) onResult(n, f.data);
  }, [f.state, f.data]);
  return (
    <button
      onClick={() => f.submit({ intent: "grade", task: String(n) }, { method: "post" })}
      disabled={f.state !== "idle"}
      className="rounded border border-line px-2.5 py-0.5 font-semibold hover:border-accent disabled:opacity-60"
    >
      {f.state !== "idle" ? "Checking…" : "Check"}
    </button>
  );
}

function History({ attempts }: { attempts: Attempt[] }) {
  return (
    <section>
      <h3 className="mb-2 font-bold">History</h3>
      <table className="w-full text-left text-sm">
        <thead className="text-muted">
          <tr>
            <th className="py-1 font-normal">Date</th>
            <th className="py-1 font-normal">Time</th>
            <th className="py-1 text-right font-normal">Score</th>
          </tr>
        </thead>
        <tbody>
          {attempts.map((a) => (
            <tr key={a.id} className="border-t border-line">
              <td className="py-1.5">{new Date(a.startedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</td>
              <td className="py-1.5 font-mono">
                {clock(a.seconds)}
                {a.budgetSeconds && <span className="text-muted"> of {clock(a.budgetSeconds)}</span>}
              </td>
              <td className={`py-1.5 text-right font-semibold ${a.score >= PASS_MARK ? "text-done" : "text-missed"}`}>{a.score}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
