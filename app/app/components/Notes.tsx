import { useEffect, useRef, useState } from "react";

/**
 * The topic's notes, under every lesson. Saves 1 second after typing stops, and at once when you
 * click away, leave the topic or close the page, so nothing typed is lost. Text saved from another window shows
 * here when this box isn't being typed in.
 */
export function Notes({ action, body }: { action: string; body: string }) {
  const [text, setText] = useState(body);
  const [saving, setSaving] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  // The text waiting to be saved, or null when everything is saved.
  const unsaved = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inflight = useRef(0);

  const save = () => {
    clearTimeout(timer.current);
    const value = unsaved.current;
    if (value === null) return;
    unsaved.current = null;
    inflight.current++;
    setSaving(true);
    // keepalive lets the save finish after the page has gone.
    fetch(action, { method: "POST", body: new URLSearchParams({ body: value }), keepalive: true })
      .catch(() => {})
      .finally(() => {
        inflight.current--;
        setSaving(inflight.current > 0);
      });
  };

  useEffect(() => {
    addEventListener("pagehide", save);
    return () => {
      removeEventListener("pagehide", save);
      save();
    };
  }, [action]);

  useEffect(() => {
    if (unsaved.current === null && !inflight.current && document.activeElement !== box.current) setText(body);
  }, [body]);

  const change = (value: string) => {
    setText(value);
    unsaved.current = value;
    clearTimeout(timer.current);
    timer.current = setTimeout(save, 1000);
  };

  const status = saving ? "Saving" : unsaved.current === null ? "Saved" : "";
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
        ref={box}
        value={text}
        onChange={(e) => change(e.target.value)}
        onBlur={save}
        rows={8}
        placeholder="Add notes"
        aria-label="Notes"
        className="block w-full rounded-b-md border-t border-line bg-surface p-4 font-mono text-sm leading-6 focus:outline-none"
      />
    </details>
  );
}
