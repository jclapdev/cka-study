import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { PASS_MARK } from "~/content/links";
import type { Section, Task } from "~/content/parse";
import type { PracticeRun as Run } from "~/db/progress";
import type { TaskResult } from "~/lab/grade";
import { useConfirm } from "./Confirm";
import { type Lab, startQuestion } from "./LabPane";
import { Markdown } from "./Markdown";

type Practice = Extract<Section, { kind: "practice" }>;
type Graded = { results?: TaskResult[]; error?: string };
/** Each checked task by number, or why its check couldn't run; `all` is why checking every task failed. */
type Results = Record<string, TaskResult | string>;

type Attempt = { id: number; startedAt: string; seconds: number; budgetSeconds: number | null; score: number };

const clock = (s: number) => {
  const a = Math.abs(s);
  return `${s < 0 ? "−" : ""}${Math.floor(a / 60)}:${String(a % 60).padStart(2, "0")}`;
};

/**
 * The practice exam. A run is kept on the server from Start to Save score or Quit, so a reload or a
 * look at another lesson keeps its clock and its checks. On a topic with a lab, Start resets the lab
 * and the clock starts once it is running, as the exam's clock never waits.
 */
export function PracticeRun({
  practice,
  checkHtml,
  attempts,
  run,
  grader,
  lab,
}: {
  practice: Practice;
  checkHtml: string | null;
  attempts: Attempt[];
  run: Run | null;
  grader: boolean;
  lab?: Lab;
}) {
  const action = useFetcher<{ error?: string }>();
  const grading = useFetcher<Graded>();
  const send = (intent: string, extra: Record<string, string> = {}) => action.submit({ intent, ...extra }, { method: "post" });
  const [now, setNow] = useState(Date.now());
  const budget = practice.minutes ? practice.minutes * 60 : null;
  const startedAt = run?.startedAt ? Date.parse(run.startedAt) : null;
  const endedAt = run?.endedAt ? Date.parse(run.endedAt) : null;
  const results = (run?.results ?? {}) as Results;
  const passed = run?.passed ?? [];

  useEffect(() => {
    if (!startedAt || endedAt) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt, endedAt]);

  const [ask, dialog] = useConfirm();
  const start = async () => {
    if (lab && !(await ask(startQuestion(lab, "exam")!, "Start"))) return;
    send("practice-start");
    document.querySelector("article")?.scrollIntoView(); // the page, or its pane beside the terminal
  };

  // Finish checks every task; the learner marks tasks by hand only when there is no grader or it could not run.
  const checking = grading.state !== "idle";
  const checkAll = () => grading.submit({ intent: "grade" }, { method: "post" });
  const graded = grader && practice.tasks.every((t) => typeof results[t.n] === "object");
  const manual = !grader || (!checking && typeof results.all === "string");
  const scoreOf = (t: Task) => {
    const r = results[t.n];
    return graded && typeof r === "object" ? r.score : passed.includes(t.n) ? t.weight : 0;
  };
  const score = Math.round(practice.tasks.reduce((a, t) => a + scoreOf(t), 0));
  const elapsed = startedAt ? Math.max(0, Math.round(((endedAt ?? now) - startedAt) / 1000)) : 0;

  // Not running: the tasks, a start button, the solution and past attempts.
  if (!run)
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-line bg-surface px-5 py-4">
          <p>
            {practice.tasks.length} tasks
            {practice.minutes && <>, {practice.minutes} minutes</>}.
          </p>
          <button
            onClick={start}
            disabled={action.state !== "idle" || lab?.blocked}
            className="rounded bg-accent px-4 py-2 font-semibold text-paper hover:opacity-90 disabled:opacity-60"
          >
            Start practice exam
          </button>
        </div>
        {action.data?.error && <p className="text-missed">{action.data.error}</p>}
        {lab?.blocked && <p className="text-sm text-muted">Another lab is starting. You can start the practice exam when it's ready.</p>}
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
          {startedAt ? (
            <>
              <span
                className={`font-mono text-3xl font-semibold tabular-nums ${remaining !== null && remaining < 0 ? "text-missed" : ""}`}
                role="timer"
                // The server draws the clock a moment before the browser does, so their seconds can differ.
                suppressHydrationWarning
              >
                {remaining !== null ? clock(remaining) : clock(elapsed)}
              </span>
              <span className="ml-3 text-sm text-muted">
                {remaining === null ? "elapsed" : remaining < 0 ? "over time" : "left"}
              </span>
            </>
          ) : (
            <span className="flex items-center gap-3 text-muted">
              <span aria-hidden className="size-5 animate-spin rounded-full border-2 border-line border-t-accent" />
              Your lab will be ready shortly. The clock starts then.
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              if (await ask("Quit the practice exam? Your checks so far are lost and no score is saved.", "Quit")) send("practice-quit");
            }}
            className="rounded border border-line px-3 py-2 text-sm hover:border-accent">
            Quit
          </button>
          {startedAt && !endedAt && (
            <button
              onClick={async () => {
                if (!(await ask(`Finish the practice exam? The clock stops, and ${grader ? "every task is checked" : "you mark the tasks you passed"}.`, "Finish"))) return;
                send("practice-finish");
                if (grader) checkAll();
              }}
              className="rounded bg-accent px-4 py-2 font-semibold text-paper">
              Finish
            </button>
          )}
        </div>
      </div>

      {!startedAt ? null : !endedAt ? (
        <>
          <Markdown html={practice.introHtml} />
          <Tasks tasks={practice.tasks} results={results} check={grader} />
        </>
      ) : (
        <>
          <p>
            You took {clock(elapsed)}.{" "}
            {checking ? "Checking each task…" : manual ? "Mark each task you passed." : null}
          </p>
          {grader && manual && typeof results.all === "string" && (
            <div className="flex flex-wrap items-center gap-4 rounded-md border border-missed px-5 py-3">
              <p className="text-missed">{results.all}</p>
              <button
                onClick={checkAll}
                className="ml-auto rounded border border-line px-3 py-1.5 text-sm font-semibold hover:border-accent"
              >
                Check again
              </button>
            </div>
          )}
          {manual ? (
            <Tasks
              tasks={practice.tasks}
              passed={passed}
              onToggle={(n) => send("practice-pass", { passed: JSON.stringify(passed.includes(n) ? passed.filter((x) => x !== n) : [...passed, n]) })}
            />
          ) : (
            <Tasks tasks={practice.tasks} results={results} />
          )}
          <div className="flex flex-wrap items-center gap-4 rounded-md border border-line bg-surface px-5 py-4">
            <p className="text-lg">
              Score <strong className={score >= PASS_MARK ? "text-done" : "text-missed"}>{checking ? "…" : `${score}%`}</strong>
              <span className="ml-2 text-sm text-muted">pass mark {PASS_MARK}%</span>
            </p>
            <button onClick={() => send("attempt")} disabled={checking} className="ml-auto rounded bg-accent px-4 py-2 font-semibold text-paper disabled:opacity-60">
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
      {dialog}
    </div>
  );
}

function Tasks({
  tasks,
  passed,
  onToggle,
  results = {},
  check,
}: {
  tasks: Task[];
  passed?: number[];
  onToggle?: (n: number) => void;
  results?: Results;
  check?: boolean;
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
                {check && <CheckTask n={t.n} />}
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

/** Runs one task's checks; the result is kept with the run and shows from there. */
function CheckTask({ n }: { n: number }) {
  const f = useFetcher<Graded>();
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
