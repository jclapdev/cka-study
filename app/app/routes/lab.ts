import { spawn } from "node:child_process";
import path from "node:path";
import { data } from "react-router";
import type { Route } from "./+types/lab";
import { labSection } from "~/content/parse";
import { readMarkdown, REPO } from "~/content/repo";

// One lab at a time: two restores at once would clone over each other.
let busy = false;

/** POST /lab/:state runs `lab/start.sh <state>` on the Mac and streams its output. */
export async function action({ params, request }: Route.ActionArgs) {
  // It wipes the machines, so only the app's own pages may ask.
  if (request.headers.get("origin") !== new URL(request.url).origin) throw data("Forbidden", { status: 403 });
  const state = params.state;
  if (!/^[a-z]+$/.test(state) || !labSection(readMarkdown("lab/README.md") ?? "", state))
    throw data(`No starting state ${state}`, { status: 400 });
  if (busy) throw data("A lab is already being prepared.", { status: 409 });
  busy = true;

  const child = spawn(path.join(REPO, "lab/start.sh"), [state], { cwd: REPO });
  // If the page goes away, the script still finishes: stopping a restore halfway leaves
  // broken machines. Its output just stops being sent, since writing to a closed stream
  // throws and would stop the dev server.
  let open = true;
  const body = new ReadableStream<Uint8Array>({
    start(ctrl) {
      const send = (d: Uint8Array | string) => open && ctrl.enqueue(typeof d === "string" ? new TextEncoder().encode(d) : d);
      child.stdout.on("data", send);
      child.stderr.on("data", send);
      child.on("error", (e) => send(`${e.message}\n`));
      // The last line tells the page whether it worked.
      child.on("close", (code) => {
        busy = false;
        send(`\n[exit ${code}]\n`);
        if (open) ctrl.close();
        open = false;
      });
    },
    cancel() {
      open = false;
    },
  });
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
