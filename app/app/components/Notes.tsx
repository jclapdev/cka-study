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
    <section aria-labelledby="notes" className="mt-16">
      <div className="flex items-baseline justify-between">
        <h2 id="notes" className="text-xl font-bold">
          Your notes
        </h2>
        <span className="text-sm text-muted" aria-live="polite">
          {status}
        </span>
      </div>
      <textarea
        value={text}
        onChange={(e) => change(e.target.value)}
        rows={8}
        placeholder="What tripped you up, flags to remember, commands worth keeping."
        className="mt-3 w-full rounded-md border border-line bg-surface p-4 font-mono text-sm leading-6 focus:border-accent focus:outline-none"
      />
    </section>
  );
}
