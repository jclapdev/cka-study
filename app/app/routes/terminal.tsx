import { useRouteLoaderData } from "react-router";
import type { loader as rootLoader } from "~/root";
import { useLab } from "~/components/LabPane";
import { Pane } from "~/components/Pane";

export const meta = () => [{ title: "Terminal · CKA Prep" }];

/** The terminal in a window of its own, opened by Pop out. */
export default function TerminalWindow() {
  const lab = useLab(useRouteLoaderData<typeof rootLoader>("root")!.lab.lab);
  return (
    <div className="h-dvh">
      <Pane lab={lab} terminals />
    </div>
  );
}

export { Problem as ErrorBoundary } from "~/root";
