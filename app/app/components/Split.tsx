import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouteLoaderData } from "react-router";
import { type SplitName, setPref } from "~/prefs";
import type { loader as rootLoader } from "~/root";

/**
 * The page on the left and a pane on the right, each filling the screen beside the topic list
 * (17rem, from root.tsx, unless hidden) and scrolling on its own. Below lg the right pane is the
 * bottom part. The divider between them drags, and each side keeps at least 320px. The left pane
 * keeps main's padding, which the practice exam's sticky clock bar relies on.
 *
 * Below lg the split starts under root.tsx's 4rem top bar, so the topic list stays in reach.
 * `rightHidden` hides the right side, which stays mounted. `place` scrolls the left pane once it is
 * drawn, for a page that was scrolling the window before the split appeared. `name` picks which
 * saved width to use: the lesson beside its lab, or a page beside a reference.
 */
export function Split({ name, left, right, rightHidden, rightSmall, place, label }: {
  name: SplitName;
  left: React.ReactNode;
  right: React.ReactNode;
  rightHidden?: boolean;
  /** Below lg, the right side takes only the height it needs, such as a Start lab bar. */
  rightSmall?: boolean;
  place?: (pane: HTMLElement) => void;
  label: string;
}) {
  const grid = useRef<HTMLDivElement>(null);
  const pane = useRef<HTMLDivElement>(null);
  // The left side's share of the width (the height below lg) in percent, saved in a cookie so the
  // server draws it at the width it was left.
  const [split, setSplit] = useState(useRouteLoaderData<typeof rootLoader>("root")!.prefs.split[name]);
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const lg = matchMedia("(min-width: 64rem)");
    const onChange = () => setWide(lg.matches);
    onChange();
    lg.addEventListener("change", onChange);
    return () => lg.removeEventListener("change", onChange);
  }, []);
  useLayoutEffect(() => place?.(pane.current!), []);
  const keep = (p: number) => {
    setPref(`split-${name}`, String(p));
    return p;
  };
  const length = () => {
    const r = grid.current!.getBoundingClientRect();
    return { start: wide ? r.left : r.top, total: wide ? r.width : r.height };
  };
  // Each side's share is at least 320px, or half when the screen is narrower than 640px.
  const clamp = (p: number) => {
    const { total } = length();
    const min = (Math.min(320, total / 2) / total) * 100;
    return Math.min(Math.max(p, min), 100 - min);
  };
  const drag = (e: React.PointerEvent) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const { start, total } = length();
    setSplit(clamp((((wide ? e.clientX : e.clientY) - start) / total) * 100));
  };
  const shown = rightHidden ? 100 : split;
  const onKey = (e: React.KeyboardEvent) => {
    const step = { ArrowLeft: -5, ArrowUp: -5, ArrowRight: 5, ArrowDown: 5 }[e.key];
    let p: number;
    if (e.key === "Home") p = 0;
    else if (e.key === "End") p = 100;
    else if (!step) return;
    else p = split + step;
    e.preventDefault();
    setSplit(keep(clamp(p)));
  };

  // Rows below lg and columns from lg up are set apart in CSS, so a phone gets its own layout from
  // the first paint instead of the wide one corrected after load.
  const small = rightSmall && !rightHidden;
  const tracks = `minmax(0,${shown}fr) minmax(0,${100 - shown}fr)`;
  return (
    <div
      ref={grid}
      style={{ "--rows": small ? "minmax(0,1fr) auto" : tracks, "--cols": tracks } as React.CSSProperties}
      className="fixed inset-0 top-16 z-20 grid grid-rows-(--rows) bg-paper lg:top-0 lg:left-[17rem] lg:grid-cols-(--cols) lg:grid-rows-1 lg:group-data-[sidebar=hidden]/app:left-0"
    >
      <div ref={pane} id="lesson" className="min-h-0 overflow-y-auto px-4 py-8 sm:px-10">{left}</div>
      <div className={`relative min-h-0 ${rightHidden ? "" : "border-t border-line lg:border-l lg:border-t-0"}`}>
        <div className={`relative h-full ${rightHidden ? "invisible overflow-hidden" : ""}`}>{right}</div>
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
            aria-valuetext={`Left side ${Math.round(shown)}%`}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={drag}
            onLostPointerCapture={() => setSplit(keep)}
            // As an update, so it saves after the one the second click's release queued.
            onDoubleClick={() => setSplit(() => keep(50))}
            onKeyDown={onKey}
            className={`group absolute inset-x-0 top-0 z-30 h-2 cursor-row-resize touch-none items-center justify-center outline-none lg:inset-x-auto lg:inset-y-0 lg:left-0 lg:h-auto lg:w-2 lg:cursor-col-resize ${small ? "hidden lg:flex" : "flex"}`}
          >
            <span className="h-1 w-10 rounded-full bg-line group-hover:bg-accent group-focus-visible:bg-accent group-focus-visible:ring-2 group-focus-visible:ring-accent lg:h-10 lg:w-1" />
          </div>
        )}
      </div>
    </div>
  );
}
