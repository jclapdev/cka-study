import { useState } from "react";
import { useRevalidator, useRouteLoaderData } from "react-router";
import type { loader as rootLoader } from "~/root";
import { Terminal } from "~/components/Terminal";

/** Starts, or resets, a lab through POST /lab/<lab>, and says whether it is ready. */
export function useLab(lab: string | null) {
  const s = useRouteLoaderData<typeof rootLoader>("root")!.lab;
  const revalidator = useRevalidator();
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/lab/${lab}`, { method: "POST" });
      revalidator.revalidate();
      // The start is over when the script's output ends.
      await res.body?.pipeTo(new WritableStream());
    } catch {}
    setBusy(false);
    revalidator.revalidate();
  };

  const mine = s.lab === lab;
  const status =
    s.status === "unavailable" ? "unavailable"
    : busy || (mine && s.status === "starting") ? "starting"
    : mine && s.status === "running" ? "running"
    : mine && s.status === "failed" ? "failed"
    : "stopped";
  return { status, start, blocked: s.status === "starting" } as const;
}

export function LabPane({ lab }: { lab: ReturnType<typeof useLab> }) {
  const reset = () => confirm("Reset the lab? Everything on the machines is lost.") && lab.start();
  if (lab.status === "running") return <Terminal onReset={reset} />;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#1b2433] px-6 text-center text-[#e3e8ef] dark:bg-[#0b0e13]">
      {lab.status === "starting" ? (
        <>
          <span aria-hidden className="size-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          <p>Your lab will be ready shortly.</p>
        </>
      ) : lab.status === "unavailable" ? (
        <p>Docker is not running. Start Docker, then reload this page.</p>
      ) : (
        <>
          {lab.status === "failed" && <p>The lab didn't start.</p>}
          <button onClick={lab.start} disabled={lab.blocked} className="rounded bg-accent px-4 py-2 font-semibold text-paper hover:opacity-90 disabled:opacity-60">
            {lab.status === "failed" ? "Try again" : "Start lab"}
          </button>
        </>
      )}
    </div>
  );
}
