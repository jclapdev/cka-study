import { useEffect, useRef, useState } from "react";

/** `ask(text, yes)` opens a dialog with `yes` and Cancel, and resolves true when `yes` is pressed. Render `dialog` once. */
export function useConfirm() {
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState<{ text: string; yes: string; resolve: (ok: boolean) => void } | null>(null);
  useEffect(() => {
    if (q && !ref.current?.open) ref.current?.showModal();
  }, [q]);
  const ask = (text: string, yes: string) => new Promise<boolean>((resolve) => setQ({ text, yes, resolve }));
  const done = (ok: boolean) => {
    q?.resolve(ok);
    setQ(null);
    if (ref.current?.open) ref.current.close();
  };
  const dialog = (
    <dialog
      ref={ref}
      onClose={() => done(false)}
      className="m-auto max-w-sm rounded-lg border border-line bg-surface p-6 text-ink shadow-xl backdrop:bg-black/40"
    >
      {q && (
        <>
          <p>{q.text}</p>
          <div className="mt-6 flex justify-end gap-2">
            <button autoFocus onClick={() => done(false)} className="rounded border border-line px-4 py-2 hover:border-accent">
              Cancel
            </button>
            <button onClick={() => done(true)} className="rounded bg-accent px-4 py-2 font-semibold text-paper hover:opacity-90">
              {q.yes}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
  return [ask, dialog] as const;
}
