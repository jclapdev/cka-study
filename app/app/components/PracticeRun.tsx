import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import type { Section, Task } from "~/content/parse";
import { Markdown } from "./Markdown";

type Practice = Extract<Section, { kind: "practice" }>;
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
  terminalButton,
}: {
  practice: Practice;
  checkHtml: string | null;
  attempts: Attempt[];
  onRunning: (running: boolean) => void;
  grader: boolean;
  terminalButton: React.ReactNode;
}) {
  const fetcher = useFetcher();
  const grading = useFetcher<{ grade: string }>();
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

  const start = () => {
    setStartedAt(Date.now());
    setNow(Date.now());
    setEndedAt(null);
    setPassed([]);
    document.querySelector("article")?.scrollIntoView(); // the page, or its pane beside the terminal
  };
  const reset = () => {
    setStartedAt(null);
    setEndedAt(null);
  };

  const elapsed = startedAt ? Math.round(((endedAt ?? now) - startedAt) / 1000) : 0;
  const score = practice.tasks.filter((t) => passed.includes(t.n)).reduce((a, t) => a + t.weight, 0);

  const save = () => {
    fetcher.submit(
      {
        intent: "attempt",
        startedAt: new Date(startedAt!).toISOString(),
        seconds: String(elapsed),
        passed: JSON.stringify(passed),
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
            {practice.minutes && <> in {practice.minutes} minutes</>}. The clock and the tasks replace the page until you finish.
          </p>
          <button onClick={start} className="rounded bg-accent px-4 py-2 font-semibold text-paper hover:opacity-90">
            Start timed run
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
          {terminalButton}
          <button onClick={reset} className="rounded border border-line px-3 py-2 text-sm hover:border-accent">
            Abandon
          </button>
          {!endedAt && (
            <button onClick={() => setEndedAt(Date.now())} className="rounded bg-accent px-4 py-2 font-semibold text-paper">
              Finish and mark
            </button>
          )}
        </div>
      </div>

      {!endedAt ? (
        <>
          <Markdown html={practice.introHtml} />
          <Tasks tasks={practice.tasks} />
        </>
      ) : (
        <>
          <p>Took {clock(elapsed)}. Run the checks below, then tick every task that passed.</p>
          <Tasks tasks={practice.tasks} passed={passed} onToggle={(n) => setPassed((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]))} />
          <div className="flex flex-wrap items-center gap-4 rounded-md border border-line bg-surface px-5 py-4">
            <p className="text-lg">
              Score <strong className={score >= PASS_MARK ? "text-done" : "text-missed"}>{score}%</strong>
              <span className="ml-2 text-sm text-muted">pass mark {PASS_MARK}%</span>
            </p>
            <button onClick={save} className="ml-auto rounded bg-accent px-4 py-2 font-semibold text-paper">
              Save attempt
            </button>
          </div>
          {grader && (
            <section>
              <button
                onClick={() => grading.submit({ intent: "grade" }, { method: "post" })}
                disabled={grading.state !== "idle"}
                className="rounded border border-line px-4 py-2 font-semibold hover:border-accent disabled:opacity-60"
              >
                {grading.state !== "idle" ? "Grading…" : "Run grader"}
              </button>
              {grading.data?.grade && (
                <pre className="mt-3 overflow-x-auto rounded-md border border-line bg-surface px-5 py-4 font-mono text-sm">{grading.data.grade}</pre>
              )}
            </section>
          )}
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

function Tasks({ tasks, passed, onToggle }: { tasks: Task[]; passed?: number[]; onToggle?: (n: number) => void }) {
  return (
    <ol className="space-y-3">
      {tasks.map((t) => (
        <li key={t.n} className="rounded-md border border-line bg-surface px-5 py-4">
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {onToggle ? (
              <label className="flex cursor-pointer items-center gap-2 font-semibold">
                <input type="checkbox" checked={passed!.includes(t.n)} onChange={() => onToggle(t.n)} className="size-4 accent-done" />
                Task {t.n} passed
              </label>
            ) : (
              <span className="font-semibold">Task {t.n}</span>
            )}
            <span className="text-muted">
              on <span className="font-mono text-ink">{t.hosts.join(", ")}</span>
            </span>
            <span className="ml-auto font-semibold">{t.weight}%</span>
          </div>
          <Markdown html={t.html} />
        </li>
      ))}
    </ol>
  );
}

function History({ attempts }: { attempts: Attempt[] }) {
  return (
    <section>
      <h3 className="mb-2 font-bold">Past attempts</h3>
      <table className="w-full text-left text-sm">
        <thead className="text-muted">
          <tr>
            <th className="py-1 font-normal">Date</th>
            <th className="py-1 font-normal">Time taken</th>
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
