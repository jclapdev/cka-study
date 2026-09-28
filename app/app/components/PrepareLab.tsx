import { useEffect, useRef, useState } from "react";

type Status = "idle" | "running" | "ready" | "failed";

/** Runs `lab/start.sh <state>` on the Mac through POST /lab/:state and shows its output as it arrives. */
export function PrepareLab({ state, onOpenTerminal }: { state: string; onOpenTerminal: () => void }) {
  const [status, setStatus] = useState<Status>("idle");
  const [out, setOut] = useState("");
  const box = useRef<HTMLPreElement>(null);

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [out]);

  const prepare = async () => {
    setStatus("running");
    setOut("");
    let text = "";
    try {
      const res = await fetch(`/lab/${state}`, { method: "POST" });
      if (!res.ok || !res.body) {
        setOut(await res.text());
        return setStatus("failed");
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      for (let r = await reader.read(); !r.done; r = await reader.read()) {
        text += r.value;
        setOut(text);
      }
      setStatus(/\[exit 0\]\s*$/.test(text) ? "ready" : "failed");
    } catch (e) {
      setOut(`${text}\n${(e as Error).message}`);
      setStatus("failed");
    }
  };

  return (
    <div className="mb-8 rounded-md border border-line bg-surface px-5 py-4">
      <div className="flex flex-wrap items-center gap-4">
        <p className="min-w-0 flex-1">
          Starting state <span className="font-mono font-semibold">{state}</span>. Preparing it throws away whatever is on
          the machines now.
        </p>
        <button
          onClick={prepare}
          disabled={status === "running"}
          className="rounded bg-accent px-4 py-2 font-semibold text-paper hover:opacity-90 disabled:opacity-60"
        >
          {status === "running" ? "Preparing…" : "Prepare lab"}
        </button>
      </div>
      {status === "running" && <p className="mt-3 text-sm text-muted">This takes about a minute, longer when a setup script downloads tools.</p>}
      {out && (
        <pre ref={box} aria-label="Prepare lab output" className="mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap rounded border border-line bg-paper px-4 py-3 font-mono text-sm">
          {out}
        </pre>
      )}
      {status === "ready" && (
        <div className="mt-3 flex items-center gap-4">
          <p className="font-semibold text-done">The lab is ready.</p>
          <button onClick={onOpenTerminal} className="rounded border border-line px-3 py-1.5 text-sm font-semibold hover:border-accent">
            Open terminal
          </button>
        </div>
      )}
      {status === "failed" && (
        <p className="mt-3 text-missed">
          Preparing failed. The output above says why, and <a href="/doc/lab/README.md#when-something-goes-wrong" className="underline">lab problems</a> lists
          the common causes.
        </p>
      )}
    </div>
  );
}
