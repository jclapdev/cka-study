import { useEffect, useRef, useState } from "react";
import { Link, useRevalidator, useRouteLoaderData } from "react-router";
import type { loader as rootLoader } from "~/root";

const button = "rounded bg-accent px-4 py-2 font-semibold text-paper hover:opacity-90 disabled:opacity-60";
const quiet = "rounded border border-line px-3 py-1.5 text-sm font-semibold hover:border-accent disabled:opacity-60";

/**
 * Starts, resets or stops a lab through POST /lab/<lab>, and says what the machines are doing now.
 * `terminal` opens the terminal beside the page, or is a link to a page that does.
 */
export function PrepareLab({ lab, terminal }: { lab: string; terminal: (() => void) | string | null }) {
  const s = useRouteLoaderData<typeof rootLoader>("root")!.lab;
  const revalidator = useRevalidator();
  const [busy, setBusy] = useState<"starting" | "stopping" | null>(null);
  const [out, setOut] = useState("");
  const box = useRef<HTMLPreElement>(null);

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [out]);

  const start = async () => {
    setBusy("starting");
    setOut("");
    let text = "";
    try {
      const res = await fetch(`/lab/${lab}`, { method: "POST" });
      if (!res.ok || !res.body) text = await res.text();
      else {
        // The rest of the page, and the sidebar, now show the lab as starting and follow it.
        revalidator.revalidate();
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        for (let r = await reader.read(); !r.done; r = await reader.read()) setOut((text += r.value));
      }
    } catch (e) {
      text += `\n${(e as Error).message}`;
    }
    // Kept only when it failed, to read why.
    setOut(/\[exit 0\]\s*$/.test(text) ? "" : text);
    setBusy(null);
    revalidator.revalidate();
  };

  const stop = async () => {
    setBusy("stopping");
    await fetch("/lab/stop", { method: "POST" }).catch(() => {});
    setBusy(null);
    revalidator.revalidate();
  };

  const mine = s.lab === lab;
  const startButton = (label: string) => (
    <button onClick={start} disabled={!!busy || s.status === "starting"} className={button}>
      {busy === "starting" ? "Starting…" : label}
    </button>
  );
  const terminalButton =
    typeof terminal === "string" ? (
      <Link to={terminal} className={quiet}>Open terminal</Link>
    ) : terminal ? (
      <button onClick={terminal} className={quiet}>Open terminal</button>
    ) : null;

  let text: React.ReactNode;
  let actions: React.ReactNode;
  if (busy === "starting" || (s.status === "starting" && mine)) {
    text = <>Starting the lab. This takes {firstStart(s, lab)}.</>;
    actions = startButton("Start lab");
  } else if (s.status === "unavailable") {
    text = <>Docker is not running. Start Docker, then reload this page.</>;
  } else if (s.status === "starting") {
    text = <>Another lab is starting.</>;
    actions = startButton("Start lab");
  } else if (s.status === "running" && mine) {
    text = <>The lab is running. It started at <Time iso={s.startedAt} />.</>;
    actions = (
      <>
        {terminalButton}
        <button onClick={start} disabled={!!busy} className={quiet}>Reset lab</button>
        <button onClick={stop} disabled={!!busy} className={quiet}>{busy === "stopping" ? "Stopping…" : "Stop lab"}</button>
      </>
    );
  } else if (s.status === "running") {
    text = <>Another lab is running. Starting this one resets the machines and takes {firstStart(s, lab)}.</>;
    actions = startButton("Start lab");
  } else if (s.status === "failed" && mine) {
    text = <>The lab failed to start. See <a href="/doc/lab/README.md#troubleshooting" className="underline">troubleshooting</a>.</>;
    actions = startButton("Try again");
  } else {
    text = <>Starting the lab takes {firstStart(s, lab)}.</>;
    actions = startButton("Start lab");
  }

  return (
    <div className="rounded-md border border-line bg-surface px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 basis-64">{text}</p>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {out && (
        <pre ref={box} aria-label="Lab output" className="mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap rounded border border-line bg-paper px-4 py-3 font-mono text-sm">
          {out}
        </pre>
      )}
    </div>
  );
}

type State = NonNullable<ReturnType<typeof useRouteLoaderData<typeof rootLoader>>>["lab"];

function firstStart(s: State, lab: string) {
  if (s.saved.includes(lab)) return "under a minute";
  if (!s.saved.length) return "about 6 minutes";
  return "a few minutes";
}

/** Shown in the reader's own time zone, so it is filled in after the page loads. */
function Time({ iso }: { iso: string | null }) {
  const [text, setText] = useState("");
  useEffect(() => setText(iso ? new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""), [iso]);
  return <span>{text}</span>;
}
