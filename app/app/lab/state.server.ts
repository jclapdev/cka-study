import { execFile } from "node:child_process";
import { promisify } from "node:util";

export type LabState = {
  status: "unavailable" | "none" | "stopped" | "starting" | "running" | "failed";
  /** The lab running, starting, failed or last run. A lab's machines are created from cka-<machine>:<lab>. */
  lab: string | null;
  startedAt: string | null;
  /** Labs with a saved copy, so their next start takes under a minute. */
  saved: string[];
};

/** What lab/lab.sh is doing now. routes/lab.ts sets it; one start at a time, since two would recreate the same machines. */
export const job = { starting: null as string | null, failed: null as string | null };

const run = promisify(execFile);

export async function labState(): Promise<LabState> {
  let images: string;
  try {
    images = (await run("docker", ["image", "ls", "cka-controlplane", "--format", "{{.Tag}}"], { timeout: 5000 })).stdout;
  } catch {
    return { status: "unavailable", lab: null, startedAt: null, saved: [] };
  }
  // Exits 1 when a machine does not exist, but still prints the ones that do.
  const inspect = await run("docker", ["inspect", "-f", "{{.Name}} {{.Config.Image}} {{.State.Running}} {{.State.StartedAt}}", "controlplane", "base"], { timeout: 5000 })
    .then((r) => r.stdout)
    .catch((e: { stdout?: string }) => e.stdout ?? "");
  return parseLabState(images, inspect, job);
}

/** Turns `docker image ls` tags and `docker inspect` lines into a LabState. Separate so tests need no docker. */
export function parseLabState(images: string, inspect: string, j: typeof job): LabState {
  // `clean` is the freshly built machines, not a lab. ponytail: a copy whose setup.sh changed since still counts as saved.
  const saved = images.split("\n").map((t) => t.trim()).filter((t) => t && t !== "clean" && t !== "<none>");
  const machines = Object.fromEntries(
    inspect
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        const [name, image, running, startedAt] = l.split(" ");
        return [name.replace(/^\//, ""), { lab: image.split(":")[1] ?? null, running: running === "true", startedAt }];
      }),
  );
  const cp = machines.controlplane;
  const base = { lab: cp?.lab ?? null, startedAt: null, saved };
  if (j.starting) return { ...base, status: "starting", lab: j.starting };
  if (j.failed) return { ...base, status: "failed", lab: j.failed };
  if (cp?.running && machines.base?.running) return { ...base, status: "running", startedAt: cp.startedAt };
  if (!saved.length) return { ...base, status: "none", lab: null };
  return { ...base, status: "stopped" };
}
