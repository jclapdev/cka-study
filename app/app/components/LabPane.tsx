import { useState } from "react";
import { Link, useRevalidator, useRouteLoaderData } from "react-router";
import type { loader as rootLoader } from "~/root";

/**
 * A topic's lab: whether it is running for this topic, and starting it through POST /lab/<lab>. The
 * machines run one lab at a time and it belongs to the topic that started it, so a topic sharing a
 * lab with another still starts its own. `other` is the name of the topic whose lab is running now.
 */
export function useLab(topic: string, lab: string | null) {
  const root = useRouteLoaderData<typeof rootLoader>("root")!;
  const v = root.lab;
  const revalidator = useRevalidator();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = (id: string | null) => root.domains.flatMap((d) => d.topics).find((t) => t.id === id)?.name ?? null;

  /** Recreates the machines as this topic's lab. False when the start was refused. */
  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/lab/${lab}`, { method: "POST", body: new URLSearchParams({ topic }) });
      if (!res.ok) setError((await res.text()) || "The lab didn't start.");
      return res.ok;
    } catch {
      setError("The lab didn't start.");
      return false;
    } finally {
      setBusy(false);
      revalidator.revalidate();
    }
  };

  const status =
    !v.docker ? "unavailable"
    : busy || v.starting === topic ? "starting"
    : v.owner === topic ? "running"
    : v.failed === topic ? "failed"
    : "stopped";
  return {
    topic,
    status,
    start,
    error,
    /** Another topic's lab is starting, and only one start runs at a time. */
    blocked: !!v.starting && v.starting !== topic,
    other: v.owner && v.owner !== topic ? name(v.owner) : null,
    /** The topic whose practice exam is under way, by name, when it is not this one. */
    otherExam: root.exam && root.exam !== topic ? name(root.exam) : null,
    exam: root.exam === topic,
  } as const;
}

export type Lab = ReturnType<typeof useLab>;

/**
 * What to ask before the machines are recreated, or null when nothing would be lost: Start lab asks
 * only when another topic's lab is running, Reset lab and Start practice exam always ask.
 */
export function startQuestion(lab: Lab, action: "start" | "reset" | "exam"): string | null {
  const examThere = lab.otherExam && lab.otherExam === lab.other ? " Your practice exam there ends too." : "";
  const ends = lab.other ? `the lab you started in ${lab.other} ends, and your work in it is lost.${examThere}` : null;
  if (action === "start") return ends && `Start this lab? ${ends[0].toUpperCase()}${ends.slice(1)}`;
  if (action === "reset") return `Reset the lab? Your work in it is lost.${lab.exam ? " Your practice exam ends too." : ""}`;
  return `Start the practice exam? ${ends ? `${ends[0].toUpperCase()}${ends.slice(1)}` : "The lab starts over, and your work in it is lost."}`;
}

/** What the terminal tab shows until the lab is running: Start lab, then a wait. */
export function LabStart({ lab, ask }: { lab: Lab; ask: (text: string, yes: string) => Promise<boolean> }) {
  const start = async () => {
    const q = startQuestion(lab, "start");
    if (q && !(await ask(q, "Start lab"))) return;
    lab.start();
  };
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#1b2433] px-6 py-5 text-center text-[#e3e8ef] dark:bg-[#0b0e13]">
      {lab.status === "starting" ? (
        <>
          <span aria-hidden className="size-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          <p>Your lab will be ready shortly.</p>
        </>
      ) : lab.status === "unavailable" ? (
        <p>Docker is not running. Start Docker to start the lab.</p>
      ) : (
        <>
          {(lab.status === "failed" || lab.error) && (
            <p>
              {lab.error ?? "The lab didn't start."}{" "}
              <Link to="/doc/lab/README.md#troubleshooting" className="underline">
                Troubleshooting
              </Link>{" "}
              says what to check.
            </p>
          )}
          <button onClick={start} disabled={lab.blocked} className="rounded bg-accent px-4 py-2 font-semibold text-paper hover:opacity-90 disabled:opacity-60">
            {lab.status === "failed" ? "Try again" : "Start lab"}
          </button>
          {lab.blocked && <p className="text-sm text-[#e3e8ef]/70">Another lab is starting. You can start this one when it's ready.</p>}
        </>
      )}
    </div>
  );
}
