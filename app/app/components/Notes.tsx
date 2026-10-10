import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

/** Saves 1 second after typing stops. */
export function Notes({ body }: { body: string }) {
  const fetcher = useFetcher();
  const [text, setText] = useState(body);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const change = (value: string) => {
    setText(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fetcher.submit({ intent: "note", body: value }, { method: "post" }), 1000);
  };

  const status = fetcher.state !== "idle" ? "Saving" : text === body ? "Saved" : "";
  return (
    <details className="group mt-14 rounded-md border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-baseline justify-between px-4 py-3 font-semibold">
        <span>
          <span aria-hidden className="mr-2 inline-block text-muted transition-transform group-open:rotate-90">›</span>
          Notes
        </span>
        <span className="text-sm font-normal text-muted" aria-live="polite">
          {status}
        </span>
      </summary>
      <textarea
        value={text}
        onChange={(e) => change(e.target.value)}
        rows={8}
        placeholder="Add notes"
        aria-label="Notes"
        className="block w-full rounded-b-md border-t border-line bg-surface p-4 font-mono text-sm leading-6 focus:outline-none"
      />
    </details>
  );
}
