import { useFetcher } from "react-router";
import type { RecallItem } from "~/content/parse";
import { Markdown } from "./Markdown";

export function RecallCard({ item, grade }: { item: RecallItem; grade?: "got" | "missed" }) {
  const fetcher = useFetcher();
  const current = fetcher.formData ? ((fetcher.formData.get("value") as "got" | "missed") || undefined) : grade;
  const edge = current === "got" ? "border-l-done" : current === "missed" ? "border-l-missed" : "border-l-line";
  return (
    <details className={`group rounded-md border border-line border-l-4 ${edge} bg-surface`}>
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-4 font-semibold">
        <span>{item.question}</span>
        <span className="shrink-0 text-sm font-normal text-accent group-open:hidden">Show answer</span>
      </summary>
      <div className="border-t border-line px-5 py-4">
        <Markdown html={item.answerHtml} />
        <fetcher.Form method="post" className="mt-4 flex gap-2">
          <input type="hidden" name="intent" value="recall" />
          <input type="hidden" name="key" value={item.key} />
          {(["got", "missed"] as const).map((v) => (
            <button
              key={v}
              name="value"
              value={current === v ? "" : v}
              aria-pressed={current === v}
              className={`rounded border px-3 py-1 text-sm ${
                current === v
                  ? v === "got"
                    ? "border-done bg-done text-paper"
                    : "border-missed bg-missed text-paper"
                  : "border-line hover:border-accent"
              }`}
            >
              {v === "got" ? "I knew it" : "I missed it"}
            </button>
          ))}
        </fetcher.Form>
      </div>
    </details>
  );
}
