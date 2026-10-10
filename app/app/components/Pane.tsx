import { useEffect, useRef, useState } from "react";
import { useConfirm } from "~/components/Confirm";
import { type Lab, LabStart } from "~/components/LabPane";
import type { Reference } from "~/components/ReferencePanel";
import { Terminal } from "~/components/Terminal";
import { SidebarIcon } from "~/root";

/** The most terminals open at once, as the server allows. */
const MAX = 4;

/** The terminal tabs every window shares, from ws://<dev server>/terminal. Null until the server answers. */
function useTerminalTabs(on: boolean) {
  const [tabs, setTabs] = useState<number[] | null>(null);
  const ws = useRef<WebSocket | null>(null);
  useEffect(() => {
    if (!on) return setTabs(null);
    let retry = 0;
    let gone = false;
    const connect = () => {
      const s = new WebSocket(`ws://${location.host}/terminal`);
      ws.current = s;
      s.onmessage = (e) => setTabs((JSON.parse(e.data as string) as { tabs: number[] }).tabs);
      // A dropped connection, such as a dev server restart, comes back by itself.
      s.onclose = () => {
        if (!gone) retry = window.setTimeout(connect, 1000);
      };
    };
    connect();
    return () => {
      gone = true;
      clearTimeout(retry);
      ws.current?.close();
    };
  }, [on]);
  const send = (m: object) => ws.current?.readyState === WebSocket.OPEN && ws.current.send(JSON.stringify(m));
  return { tabs, add: () => send({ add: true }), close: (id: number) => send({ close: id }) };
}

type Tab = { key: string; label: string; close?: () => void };

/**
 * The right side of a page: a row of tabs over what they show. A topic with a lab has its terminals
 * there (`terminals`), or Start lab until the lab is running; a reference or Learn page opened from
 * the page joins as a tab of its own.
 */
export function Pane({ lab, terminals, reference, onPopOut, onHide }: {
  lab?: Lab;
  terminals: boolean;
  reference?: Reference | null;
  onPopOut?: () => void;
  onHide?: () => void;
}) {
  const running = !!lab && terminals && lab.status === "running";
  const { tabs, add, close } = useTerminalTabs(running);
  const [ask, dialog] = useConfirm();
  const [active, setActive] = useState("");
  // A tab this window just asked for shows once the server adds it.
  const wanted = useRef<number[] | null>(null);

  const list: Tab[] = [];
  if (lab && terminals) {
    if (running && tabs)
      for (const id of tabs) list.push({ key: `t${id}`, label: `Terminal ${id}`, close: tabs.length > 1 ? () => close(id) : undefined });
    else list.push({ key: "lab", label: "Terminal" });
  }
  if (reference) list.push({ key: "ref", label: reference.title, close: reference.close });
  const shown = list.some((t) => t.key === active) ? active : (list.find((t) => t.key !== "ref") ?? list[0])?.key;

  useEffect(() => {
    if (reference) setActive("ref");
  }, [reference?.key]);
  useEffect(() => {
    if (!tabs || !wanted.current) return;
    const added = tabs.find((id) => !wanted.current!.includes(id));
    wanted.current = null;
    if (added) setActive(`t${added}`);
  }, [tabs]);

  const reset = async () => {
    if (lab && (await ask("Reset the lab? Your work in it is lost.", "Reset lab"))) lab.start();
  };
  const icon = "rounded p-1.5 text-muted hover:bg-paper hover:text-ink";

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-stretch border-b border-line bg-surface text-sm">
        <div role="tablist" aria-label="Panel" className="flex min-w-0 items-stretch overflow-x-auto">
          {list.map((t) => (
            <div key={t.key} className={`flex shrink-0 items-center border-r border-line ${t.key === shown ? "bg-paper" : ""}`}>
              <button
                role="tab"
                aria-selected={t.key === shown}
                onClick={() => setActive(t.key)}
                className={`max-w-48 truncate py-2 ${t.close ? "pl-3 pr-1" : "px-3"} ${t.key === shown ? "font-semibold" : "text-muted hover:text-ink"}`}
              >
                {t.label}
              </button>
              {t.close && (
                <button onClick={t.close} aria-label={`Close ${t.label}`} title="Close" className="mr-1 rounded px-1.5 leading-none text-muted hover:bg-surface hover:text-ink">
                  ×
                </button>
              )}
            </div>
          ))}
          {running && tabs && tabs.length < MAX && (
            <button
              onClick={() => {
                wanted.current = tabs;
                add();
              }}
              aria-label="New terminal"
              title="New terminal"
              className="shrink-0 px-3 text-lg leading-none text-muted hover:bg-paper hover:text-ink"
            >
              +
            </button>
          )}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1 px-2">
          {running && onPopOut && (
            <button onClick={onPopOut} aria-label="Open in new window" title="Open in new window" className={icon}>
              <PopOutIcon />
            </button>
          )}
          {running && (
            <button onClick={reset} className="rounded px-2 py-1 text-muted hover:bg-paper hover:text-ink">
              Reset lab
            </button>
          )}
          {onHide && (
            <button onClick={onHide} aria-label="Hide panel" title="Hide panel" className={icon}>
              <SidebarIcon flip />
            </button>
          )}
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        {lab && terminals && !running && shown === "lab" && <LabStart lab={lab} />}
        {running && tabs?.map((id) => <Terminal key={id} id={id} active={shown === `t${id}`} />)}
        {reference && <div className={`absolute inset-0 ${shown === "ref" ? "" : "invisible"}`}>{reference.body}</div>}
      </div>
      {dialog}
    </div>
  );
}

function PopOutIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M11.5 3.5h5v5M16.5 3.5 10 10M8.5 4.5h-4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-4" />
    </svg>
  );
}
