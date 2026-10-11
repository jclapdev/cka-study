import { useEffect } from "react";
import { useRouteLoaderData, useSearchParams } from "react-router";
import type { loader as rootLoader } from "~/root";
import { useLab } from "~/components/LabPane";
import { Pane } from "~/components/Pane";
import { useAnnouncePopout } from "~/components/popout";

export const meta = () => [{ title: "Terminal · CKA Prep" }];

/**
 * A topic's terminals in a window of their own, opened by Open in new window. When the topic's lab
 * ends, because another topic started its own or it stopped, the window closes itself.
 */
export default function TerminalWindow() {
  const topic = useSearchParams()[0].get("topic") ?? "";
  const root = useRouteLoaderData<typeof rootLoader>("root")!;
  const t = root.domains.flatMap((d) => d.topics).find((x) => x.id === topic);
  const lab = useLab(topic, t && "lab" in t ? t.lab : null);
  useAnnouncePopout(topic);
  // Reset lab in this window starts the same topic's lab again, which keeps the window.
  const ended = lab.status !== "running" && lab.status !== "starting";
  useEffect(() => {
    if (ended) window.close();
  }, [ended]);
  if (ended)
    return (
      <div className="grid h-dvh place-items-center bg-paper p-6 text-center text-muted">
        <p>This lab has ended. You can close this window.</p>
      </div>
    );
  return (
    <div className="h-dvh">
      <Pane lab={lab} terminals />
    </div>
  );
}

export { Problem as ErrorBoundary } from "~/root";
