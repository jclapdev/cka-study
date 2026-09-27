import { useFetcher } from "react-router";
import type { Step as StepData } from "~/content/parse";
import { Markdown } from "./Markdown";

/** One numbered step on the rail. The marker is the checkbox. */
export function Step({ step, done, last }: { step: StepData; done: boolean; last: boolean }) {
  const fetcher = useFetcher();
  const checked = fetcher.formData ? fetcher.formData.get("value") === "done" : done;
  return (
    <li className="relative grid grid-cols-[2.25rem_1fr] gap-x-4 pb-8">
      {!last && (
        <span aria-hidden className={`absolute left-[1.0625rem] top-9 bottom-0 w-0.5 ${checked ? "bg-done" : "bg-line"}`} />
      )}
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="step" />
        <input type="hidden" name="key" value={step.key} />
        <input type="hidden" name="value" value={checked ? "" : "done"} />
        <button
          type="submit"
          aria-pressed={checked}
          aria-label={`Step ${step.label}: ${checked ? "done, click to untick" : "mark done"}`}
          className={`grid size-9 place-items-center rounded-full border-2 font-semibold transition-colors ${
            checked ? "border-done bg-done text-paper" : "border-line bg-surface text-muted hover:border-accent hover:text-accent"
          }`}
        >
          {checked ? "✓" : step.label}
        </button>
      </fetcher.Form>
      <Markdown html={step.html} className={`min-w-0 pt-1 ${checked ? "opacity-70" : ""}`} />
    </li>
  );
}
