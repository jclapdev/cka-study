import { execFile, spawn } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { data } from "react-router";
import type { Route } from "./+types/lab";
import { listLabs, REPO } from "~/content/repo";
import { job } from "~/lab/state.server";

const LAB_SH = path.join(REPO, "lab/lab.sh");

/**
 * POST /lab/<lab> runs `lab/lab.sh start <lab>` and streams its output.
 * POST /lab/stop stops the machines. No lab folder may be named `stop`.
 */
export async function action({ params, request }: Route.ActionArgs) {
  // It wipes the machines, so only the app's own pages may ask.
  if (request.headers.get("origin") !== new URL(request.url).origin) throw data("Forbidden", { status: 403 });
  if (job.starting) throw data("A lab is already starting.", { status: 409 });
  const lab = params.state;

  if (lab === "stop") {
    job.failed = null;
    await promisify(execFile)(LAB_SH, ["stop"], { cwd: REPO });
    return null;
  }
  if (!listLabs().includes(lab)) throw data(`No lab named ${lab}`, { status: 400 });
  job.starting = lab;
  job.failed = null;

  const child = spawn(LAB_SH, ["start", lab], { cwd: REPO });
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
        job.starting = null;
        if (code !== 0) job.failed = lab;
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
