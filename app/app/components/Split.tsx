import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * The page on the left and a pane on the right, each filling the screen beside the topic list
 * (17rem, from root.tsx, unless hidden) and scrolling on its own. Below lg the right pane is the
 * bottom part. The divider between them drags; a side dragged to the edge is hidden but stays
 * mounted, so a terminal keeps its session. The left pane keeps main's padding, which the practice
 * exam's sticky clock bar relies on.
 *
 * `rightHidden` hides the right side without changing the saved width. `reveal` shows both sides
 * at half width when the saved width hides one, also without saving. `place` scrolls the left pane
 * once the saved width is in, for a page that was scrolling the window before the split appeared.
 */
export function Split({ left, right, rightHidden, reveal, place, label }: {
  left: React.ReactNode;
  right: React.ReactNode;
  rightHidden?: boolean;
  reveal?: boolean;
  place?: (pane: HTMLElement) => void;
  label: string;
}) {
  const grid = useRef<HTMLDivElement>(null);
  const pane = useRef<HTMLDivElement>(null);
  // The left side's share of the width (the height below lg) in percent: 0 hides it, 100 hides the right.
  const [split, setSplit] = useState(50);
  const [wide, setWide] = useState(true);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem("split") ?? NaN);
      if (saved >= 0 && saved <= 100) setSplit(saved);
    } catch {}
    setLoaded(true);
    const lg = matchMedia("(min-width: 64rem)");
    const onChange = () => setWide(lg.matches);
    onChange();
    lg.addEventListener("change", onChange);
    return () => lg.removeEventListener("change", onChange);
  }, []);
  useLayoutEffect(() => {
    if (loaded) place?.(pane.current!);
  }, [loaded]);
  const keep = (p: number) => {
    try { localStorage.setItem("split", String(p)); } catch {}
    return p;
  };
  const length = () => {
    const r = grid.current!.getBoundingClientRect();
    return { start: wide ? r.left : r.top, total: wide ? r.width : r.height };
  };
  const drag = (e: React.PointerEvent) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const { start, total } = length();
    setSplit(settle((wide ? e.clientX : e.clientY) - start, total));
  };
  const shown = rightHidden ? 100 : reveal && (split === 0 || split === 100) ? 50 : split;
  const onKey = (e: React.KeyboardEvent) => {
    const { total } = length();
    const min = (Math.min(320, total / 2) / total) * 100;
    const step = { ArrowLeft: -5, ArrowUp: -5, ArrowRight: 5, ArrowDown: 5 }[e.key];
    let p: number;
    if (e.key === "Home") p = 0;
    else if (e.key === "End") p = 100;
    else if (!step) return;
    else if (shown === 0 || shown === 100) p = shown === 0 ? min : 100 - min;
    else p = shown + step < min ? 0 : shown + step > 100 - min ? 100 : shown + step;
    e.preventDefault();
    setSplit(keep(p));
  };

  const tracks = `minmax(0,${shown}fr) minmax(0,${100 - shown}fr)`;
  const gone = "invisible overflow-hidden p-0!";
  return (
    <div
      ref={grid}
      style={{ "--tracks": tracks } as React.CSSProperties}
      className="fixed inset-0 z-20 grid grid-rows-(--tracks) bg-paper lg:left-[17rem] lg:grid-cols-(--tracks) lg:grid-rows-1 lg:group-data-[sidebar=hidden]/app:left-0"
    >
      <div ref={pane} id="lesson" className={`min-h-0 overflow-y-auto px-4 py-8 sm:px-10 ${shown === 0 ? gone : ""}`}>{left}</div>
      <div className={`relative min-h-0 border-t border-line lg:border-l lg:border-t-0 ${shown === 100 ? "border-0" : ""}`}>
        <div className={`relative h-full ${shown === 100 ? gone : ""}`}>{right}</div>
        {!rightHidden && (
          <div
            role="separator"
            tabIndex={0}
            aria-label={label}
            aria-controls="lesson"
            aria-orientation={wide ? "vertical" : "horizontal"}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(shown)}
            aria-valuetext={shown === 0 ? "Left side hidden" : shown === 100 ? "Right side hidden" : `Left side ${Math.round(shown)}%`}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={drag}
            onLostPointerCapture={() => setSplit(keep)}
            onDoubleClick={() => setSplit(keep(50))}
            onKeyDown={onKey}
            className={`group absolute inset-x-0 top-0 z-30 flex h-2 cursor-row-resize touch-none items-center justify-center outline-none lg:inset-x-auto lg:inset-y-0 lg:left-0 lg:h-auto lg:w-2 lg:cursor-col-resize ${
              shown === 100 ? "-translate-y-full lg:translate-y-0 lg:-translate-x-full" : ""
            }`}
          >
            <span className="h-1 w-10 rounded-full bg-line group-hover:bg-accent group-focus-visible:bg-accent group-focus-visible:ring-2 group-focus-visible:ring-accent lg:h-10 lg:w-1" />
          </div>
        )}
      </div>
    </div>
  );
}

/** Where the divider lands for a pointer px into a total-px pane: each side is hidden (0 or 100) or at least 320px. */
function settle(px: number, total: number) {
  const min = Math.min(320, total / 2);
  if (px < min / 2) return 0;
  if (px > total - min / 2) return 100;
  return (Math.min(Math.max(px, min), total - min) / total) * 100;
}