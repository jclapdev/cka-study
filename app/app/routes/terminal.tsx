import { useRouteLoaderData } from "react-router";
import type { loader as rootLoader } from "~/root";
import { LabPane, useLab } from "~/components/LabPane";

export const meta = () => [{ title: "Terminal · CKA Prep" }];

/** The terminal in a window of its own, opened by Pop out. */
export default function TerminalWindow() {
  const lab = useLab(useRouteLoaderData<typeof rootLoader>("root")!.lab.lab);
  return (
    <div className="h-dvh">
      <LabPane lab={lab} />
    </div>
  );
}

export { Problem as ErrorBoundary } from "~/root";
