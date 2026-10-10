import { useCallback, useEffect, useRef, useState } from "react";
import { Markdown } from "~/components/Markdown";

/** The reference or Learn page a plain left-click landed on, or null. Other clicks open the full page as usual. */
export function referenceHref(e: React.MouseEvent) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="/doc/references/"], a[href^="/doc/learn/"]');
  if (!a) return null;
  e.preventDefault();
  return a.getAttribute("href");
}

/**
 * Reference pages opened from the page, the last one showing beside it, emptied when `page` changes.
 * `onClick` goes on the page. On a page that scrolls the window until the panel splits the screen
 * (`splitsOnOpen`), the link clicked stays at the same height on screen when the page moves into
 * the split, through `place`, and when it moves back on close.
 */
export function useReferences(page: string, splitsOnOpen: boolean) {
  const [refs, setRefs] = useState<string[]>([]);
  // The clicked link: its position among the page's links, and its distance from the top of the screen.
  const anchor = useRef<{ n: number; top: number } | null>(null);
  useEffect(() => setRefs([]), [page]);
  const onClick = (e: React.MouseEvent) => {
    const href = referenceHref(e);
    if (!href) return;
    if (!refs.length && splitsOnOpen) {
      const a = (e.target as HTMLElement).closest("a")!;
      anchor.current = { n: [...e.currentTarget.querySelectorAll("a")].indexOf(a), top: a.getBoundingClientRect().top };
    }
    setRefs([href]);
  };
  const place = (pane: HTMLElement) => {
    const a = anchor.current && pane.querySelector("article")?.querySelectorAll("a")[anchor.current.n];
    if (a) pane.scrollTop += a.getBoundingClientRect().top - anchor.current!.top;
  };
  const close = useCallback(() => {
    const a = anchor.current && document.querySelector("#lesson article")?.querySelectorAll("a")[anchor.current.n];
    const top = a?.getBoundingClientRect().top;
    setRefs([]);
    if (!splitsOnOpen || top === undefined) return;
    requestAnimationFrame(() => {
      const again = document.querySelector("main article")?.querySelectorAll("a")[anchor.current!.n];
      if (again) window.scrollBy(0, again.getBoundingClientRect().top - top);
    });
  }, [splitsOnOpen]);
  const [title, setTitle] = useState("");
  const reference = refs.length
    ? {
        title: title || "Reference",
        // Changes with each page opened, so the pane brings the reference tab to the front.
        key: refs.join(" "),
        close,
        body: <ReferencePanel refs={refs} onOpen={(h) => setRefs([...refs, h])} onBack={() => setRefs(refs.slice(0, -1))} onTitle={setTitle} />,
      }
    : null;
  return { open: refs.length > 0, onClick, reference, place: splitsOnOpen ? place : undefined };
}

export type Reference = NonNullable<ReturnType<typeof useReferences>["reference"]>;

/** The last of `refs`, a stack of reference pages opened one from another, shown in a tab beside the page. */
function ReferencePanel({ refs, onOpen, onBack, onTitle }: { refs: string[]; onOpen: (href: string) => void; onBack: () => void; onTitle: (title: string) => void }) {
  const href = refs[refs.length - 1];
  const [path, hash] = href.split("#");
  const body = useRef<HTMLDivElement>(null);
  // The page's HTML, or null when it didn't load.
  const [html, setHtml] = useState<string | null | undefined>();

  useEffect(() => {
    const abort = new AbortController();
    setHtml(undefined);
    onTitle("");
    fetch(`/reference/${path.slice("/doc/".length)}`, { signal: abort.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((doc) => {
        setHtml(doc?.html ?? null);
        onTitle(doc?.title ?? "");
      })
      .catch(() => abort.signal.aborted || setHtml(null));
    return () => abort.abort();
  }, [path]);

  useEffect(() => {
    if (!html || !body.current) return;
    const target = hash && body.current.querySelector(`#${CSS.escape(hash)}`);
    if (target) target.scrollIntoView();
    else body.current.scrollTop = 0;
  }, [html, hash]);

  return (
    <div
      ref={body}
      onClick={(e) => {
        const next = referenceHref(e);
        if (next) onOpen(next);
      }}
      className="h-full overflow-y-auto bg-paper px-6 py-6"
    >
      {refs.length > 1 && (
        <button onClick={onBack} className="-ml-2 mb-4 rounded px-2 py-1 text-sm text-muted hover:bg-surface hover:text-ink">
          ← Back
        </button>
      )}
      {html ? <Markdown html={html} /> : <p className="text-muted">{html === null ? "This page didn't load." : "Loading…"}</p>}
    </div>
  );
}
