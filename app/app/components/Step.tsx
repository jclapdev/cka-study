import { useState } from "react";
import { useFetcher } from "react-router";
import type { Step as StepData } from "~/content/parse";
import { Markdown } from "./Markdown";

/** One numbered step on the rail. The marker is the checkbox; a done step folds to its first line. */
export function Step({ step, done, last }: { step: StepData; done: boolean; last: boolean }) {
  const fetcher = useFetcher();
  const checked = fetcher.formData ? fetcher.formData.get("value") === "done" : done;
  const [open, setOpen] = useState(!done);
  const folded = checked && !open;
  return (
    <li className={`relative grid grid-cols-[2.25rem_1fr] gap-x-4 ${folded ? "pb-4" : "pb-8"}`}>
      {!last && (
        <span aria-hidden className={`absolute left-[1.0625rem] top-9 bottom-0 w-0.5 ${checked ? "bg-done" : "bg-line"}`} />
      )}
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="step" />
        <input type="hidden" name="key" value={step.key} />
        <input type="hidden" name="value" value={checked ? "" : "done"} />
        <button
          type="submit"
          onClick={() => setOpen(checked)}
          aria-pressed={checked}
          aria-label={`Step ${step.label}: ${checked ? "done, click to untick" : "mark done"}`}
          className={`grid size-9 place-items-center rounded-full border-2 font-semibold transition-colors ${
            checked ? "border-done bg-done text-paper" : "border-line bg-surface text-muted hover:border-accent hover:text-accent"
          }`}
        >
          {checked ? "✓" : step.label}
        </button>
      </fetcher.Form>
      <div className={`flex min-w-0 items-start gap-1 pt-1 ${checked ? "opacity-70" : ""}`}>
        {checked && (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={`${open ? "Hide" : "Show"} step ${step.label}`}
            className="shrink-0 px-1 text-lg leading-7 text-muted hover:text-accent"
          >
            <span aria-hidden className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}>
              ›
            </span>
          </button>
        )}
        <div
          onClick={folded ? (e) => !(e.target as Element).closest("a") && setOpen(true) : undefined}
          className={`min-w-0 flex-1 ${folded ? "cursor-pointer" : ""}`}
        >
          <Markdown
            html={step.html}
            className={folded ? "[&>*:not(:first-child)]:hidden [&>:first-child]:mb-0 [&>:first-child]:line-clamp-1" : ""}
          />
        </div>
      </div>
    </li>
  );
}
