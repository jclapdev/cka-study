import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import type { loader } from "~/routes/doc";
import { Markdown } from "~/components/Markdown";

/** The reference page a plain left-click landed on, or null. Other clicks open the full page as usual. */
export function referenceHref(e: React.MouseEvent) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="/doc/references/"]');
  if (!a) return null;
  e.preventDefault();
  return a.getAttribute("href");
}

/** The last of `refs`, a stack of reference pages opened one from another, shown beside the lesson. */
export function ReferencePanel({ refs, onOpen, onBack, onClose }: { refs: string[]; onOpen: (href: string) => void; onBack: () => void; onClose: () => void }) {
  const href = refs[refs.length - 1];
  const [path, hash] = href.split("#");
  const fetcher = useFetcher<typeof loader>();
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetcher.load(path);
  }, [path]);

  const html = fetcher.state === "idle" ? fetcher.data?.html : undefined;
  useEffect(() => {
    if (!html || !body.current) return;
    const target = hash && body.current.querySelector(`#${CSS.escape(hash)}`);
    if (target) target.scrollIntoView();
    else body.current.scrollTop = 0;
  }, [html, hash]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside aria-label="Reference" className="absolute inset-0 z-10 flex flex-col bg-paper">
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        {refs.length > 1 ? (
          <button onClick={onBack} className="rounded px-2 py-1 text-sm hover:bg-surface">
            ← Back
          </button>
        ) : <span />}
        <button onClick={onClose} aria-label="Close" title="Close" className="rounded px-2 py-1 text-lg leading-none hover:bg-surface">
          ✕
        </button>
      </div>
      <div
        ref={body}
        onClick={(e) => {
          const next = referenceHref(e);
          if (next) onOpen(next);
        }}
        className="min-h-0 flex-1 overflow-y-auto px-6 py-6"
      >
        {html ? <Markdown html={html} /> : <p className="text-muted">Loading…</p>}
      </div>
    </aside>
  );
}
