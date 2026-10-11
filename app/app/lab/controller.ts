import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import Database from "better-sqlite3";
import { REPO } from "../content/repo.ts";

// No `~` imports: the terminal plugin in vite.config.ts loads this file too, and both share one
// controller through globalThis, so a route module Vite reloads can't lose a start under way.

const run = promisify(execFile);
const MACHINES = ["controlplane", "node01", "node02", "base"];
/** Minutes with no terminal open before a running lab stops itself. */
const IDLE_MINUTES = Number(process.env.CKA_LAB_IDLE_MINUTES ?? 60);

/** What Docker shows: whether it answers, the lab controlplane was made from, and whether all four machines run. */
export type Machines = { docker: boolean; lab: string | null; up: boolean };
/** Kept in data/lab.json: the topic whose lab is on the machines, or whose start failed. */
export type Owner = { topic: string; lab: string };
export type LabRecord = { owner: Owner | null; failed: Owner | null };
/** Kept in data/lab.lock while lab.sh runs: its process, the machine it runs on, and when it began. */
type Starting = Owner & { pid: number; host: string; at: number };

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** What every page knows about the lab. Topics are ids such as 01-cluster-architecture/01-rbac. */
export type LabView = { docker: boolean; owner: string | null; starting: string | null; failed: string | null };

/**
 * The lab as pages see it. A topic owns the lab only while the machines run the lab it started, so a
 * lab started by hand, or a parent lab left mid-build, belongs to no topic. Separate so tests need no Docker.
 */
export function view(m: Machines, record: LabRecord, starting: Owner | null): LabView {
  const owned = !starting && record.owner && m.up && m.lab === record.owner.lab ? record.owner.topic : null;
  return { docker: m.docker, owner: owned, starting: starting?.topic ?? null, failed: starting ? null : (record.failed?.topic ?? null) };
}

/** Reads `docker inspect` lines, "/name image running", for the four machines. */
export function parseMachines(inspect: string): Omit<Machines, "docker"> {
  const seen = new Map<string, { image: string; running: boolean }>();
  for (const line of inspect.trim().split("\n").filter(Boolean)) {
    const [name, image, running] = line.split(" ");
    seen.set(name.replace(/^\//, ""), { image, running: running === "true" });
  }
  const cp = seen.get("controlplane");
  return { lab: cp?.image.split(":")[1] ?? null, up: MACHINES.every((n) => seen.get(n)?.running) };
}

export class BusyError extends Error {
  constructor() {
    super("Another lab is starting. Try again when it's ready.");
  }
}

class LabController {
  // Tests set CKA_LAB_FAKE to a folder holding a stand-in lab.sh and the machines.json it writes.
  readonly fake = process.env.CKA_LAB_FAKE ?? null;
  readonly script = this.fake ? path.join(this.fake, "lab.sh") : path.join(REPO, "lab/lab.sh");
  private readonly dir = path.dirname(process.env.CKA_DB ?? path.join(process.cwd(), "data", "progress.db"));
  private readonly recordFile = path.join(this.dir, "lab.json");
  private readonly lockFile = path.join(this.dir, "lab.lock");
  private readonly activeFile = path.join(this.dir, "lab.active");

  private record: LabRecord = { owner: null, failed: null };
  private starting: Starting | null = null;
  /** Whether the start under way is this process's own. */
  private own = false;
  private machines: Machines = { docker: true, lab: null, up: false };
  private probedAt = 0;
  private probing: Promise<void> | null = null;
  private last = "";
  private readonly listeners = new Set<(v: LabView) => void>();
  private readonly resets = new Set<() => void>();
  private attached = 0;
  private activeAt = Date.now();

  /** Changes each time the machines are recreated or stopped, so terminal tabs from before start over. */
  gen = Date.now();

  private readonly timers: ReturnType<typeof setInterval>[] = [];

  /** `version` is this file's modification time, so a controller from older code can be told apart. */
  constructor(readonly version: number) {
    fs.mkdirSync(this.dir, { recursive: true });
    this.sync();
    this.timers.push(
      setInterval(() => this.listeners.size && this.probe(), 5000).unref(),
      setInterval(() => this.idle(), Math.min(60_000, IDLE_MINUTES * 30_000)).unref(),
    );
  }

  /** Stops this controller's timers, when newer code replaces it. */
  dispose() {
    this.timers.forEach(clearInterval);
  }

  /**
   * Reads the record and the start under way from data/, which another server on this computer may
   * have changed: the Docker app and a dev server both drive the same machines. A start this process
   * didn't see finish counts as failed once its lab.sh has gone. Another machine's process numbers
   * mean nothing here (the Docker app runs in a container), so its start counts as under way for
   * 15 minutes, longer than any start takes.
   */
  private sync() {
    try {
      this.record = { owner: null, failed: null, ...JSON.parse(fs.readFileSync(this.recordFile, "utf8")) };
    } catch {
      this.record = { owner: null, failed: null };
    }
    if (this.own) return;
    let lock: Starting;
    try {
      lock = JSON.parse(fs.readFileSync(this.lockFile, "utf8"));
    } catch {
      this.starting = null;
      return;
    }
    const live = lock.host === os.hostname() ? alive(lock.pid) : Date.now() - lock.at < 15 * 60_000;
    if (live) {
      // Another server is recreating the machines, so the shells this one serves end with them.
      if (!this.starting) this.reset();
      this.starting = lock;
      return;
    }
    this.starting = null;
    fs.rmSync(this.lockFile, { force: true });
    this.save({ owner: null, failed: { topic: lock.topic, lab: lock.lab } });
  }

  private save(record: LabRecord) {
    this.record = record;
    fs.writeFileSync(this.recordFile, JSON.stringify(record));
  }

  view(): LabView {
    return view(this.machines, this.record, this.starting);
  }

  /** The view, from Docker at most 3 seconds old. */
  async fresh(): Promise<LabView> {
    if (Date.now() - this.probedAt > 3000) await this.probe();
    return this.view();
  }

  probe(): Promise<void> {
    this.probing ??= this.readMachines()
      .then((m) => {
        this.sync();
        this.machines = m;
        this.probedAt = Date.now();
        this.emit();
      })
      .finally(() => (this.probing = null));
    return this.probing;
  }

  private async readMachines(): Promise<Machines> {
    if (this.fake) {
      try {
        return { docker: true, ...JSON.parse(fs.readFileSync(path.join(this.fake, "machines.json"), "utf8")) };
      } catch {
        return { docker: true, lab: null, up: false };
      }
    }
    // Exits 1 when a machine doesn't exist, but still prints the ones that do.
    const out = await run("docker", ["inspect", "-f", "{{.Name}} {{.Config.Image}} {{.State.Running}}", ...MACHINES], { timeout: 5000 }).then(
      (r) => ({ ok: true, stdout: r.stdout, stderr: "" }),
      (e: { stdout?: string; stderr?: string }) => ({ ok: false, stdout: e.stdout ?? "", stderr: e.stderr ?? "" }),
    );
    if (!out.ok && !out.stdout && !/No such/i.test(out.stderr)) return { docker: false, lab: null, up: false };
    return { docker: true, ...parseMachines(out.stdout) };
  }

  /** Calls `fn` with the view now and on every change; returns the unsubscribe. */
  subscribe(fn: (v: LabView) => void) {
    this.listeners.add(fn);
    fn(this.view());
    return () => this.listeners.delete(fn);
  }

  private emit() {
    const v = this.view();
    const s = JSON.stringify(v);
    if (s === this.last) return;
    this.last = s;
    this.listeners.forEach((f) => f(v));
  }

  /** Runs `fn` whenever the machines are about to be recreated or stopped. */
  onReset(fn: () => void) {
    this.resets.add(fn);
    return () => this.resets.delete(fn);
  }

  private reset() {
    this.gen = Date.now();
    this.resets.forEach((f) => f());
  }

  /**
   * Starts `lab` for `topic`, recreating the machines; resolves with lab.sh's exit code. `done` runs
   * with that code before pages hear the outcome, so what it records shows with it.
   */
  start(topic: string, lab: string, done?: (code: number) => void): Promise<number> {
    this.sync();
    if (this.starting) throw new BusyError();
    const child = spawn(this.script, ["start", lab], { cwd: REPO });
    this.own = true;
    this.starting = { topic, lab, pid: child.pid ?? 0, host: os.hostname(), at: Date.now() };
    fs.writeFileSync(this.lockFile, JSON.stringify(this.starting));
    this.save({ owner: null, failed: null });
    this.reset();
    this.emit();
    // Its output goes to the dev server's log; the page learns the outcome from the view.
    child.stdout.on("data", (d) => process.stdout.write(d));
    child.stderr.on("data", (d) => process.stderr.write(d));
    return new Promise((resolve) => {
      let over = false;
      const finish = async (code: number) => {
        if (over) return;
        over = true;
        this.own = false;
        this.starting = null;
        fs.rmSync(this.lockFile, { force: true });
        this.save(code === 0 ? { owner: { topic, lab }, failed: null } : { owner: null, failed: { topic, lab } });
        try {
          done?.(code);
        } catch (e) {
          console.error(e);
        }
        this.activeAt = Date.now();
        await this.probe();
        this.emit();
        resolve(code);
      };
      child.on("error", () => finish(1));
      child.on("close", (code) => finish(code ?? 1));
    });
  }

  /** How many terminal windows are attached now; the idle clock runs only while there are none. */
  setAttached(n: number) {
    this.attached = n;
    this.activeAt = Date.now();
  }

  touch() {
    this.activeAt = Date.now();
  }

  /**
   * Stops the lab once no server has had a terminal open on it for IDLE_MINUTES. Each server marks
   * data/lab.active while it has one, so a server with no terminals doesn't stop a lab in use through
   * another.
   */
  private async idle() {
    if (this.attached) {
      this.touch();
      return fs.writeFileSync(this.activeFile, "");
    }
    if (this.starting || !this.view().owner) return;
    let shared = 0;
    try {
      shared = fs.statSync(this.activeFile).mtimeMs;
    } catch {}
    if (Date.now() - Math.max(this.activeAt, shared) < IDLE_MINUTES * 60_000 || this.examOpen()) return;
    this.reset();
    await run(this.script, ["stop"], { cwd: REPO }).catch(() => {});
    await this.probe();
  }

  /** Whether a practice exam is under way, which keeps its lab running however long it sits. */
  private examOpen() {
    try {
      const db = new Database(path.join(this.dir, path.basename(process.env.CKA_DB ?? "progress.db")), { readonly: true });
      try {
        return !!db.prepare("select 1 from practice_run where endedAt is null").get();
      } finally {
        db.close();
      }
    } catch {
      return false;
    }
  }
}

const KEY = Symbol.for("cka.lab");
const SOURCE = path.join(REPO, "app/app/lab/controller.ts");

/**
 * The one lab controller for this server. The server keeps running while this file changes during
 * development, so a controller made by older code is replaced, and its timers stopped; what it knew
 * is in data/ for the new one to read.
 */
export function labController(): LabController {
  const g = globalThis as { [KEY]?: LabController };
  let version = 0;
  try {
    version = fs.statSync(SOURCE).mtimeMs;
  } catch {}
  const old = g[KEY];
  if (old?.version === version) return old;
  // A controller from before `version` and `dispose` existed: leave its timers nothing to do.
  if (old) typeof old.dispose === "function" ? old.dispose() : Object.assign(old, { idle: async () => {}, probe: async () => {} });
  return (g[KEY] = new LabController(version));
}
