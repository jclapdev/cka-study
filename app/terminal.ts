import { execFile } from "node:child_process";
import fs from "node:fs";
import type { IncomingMessage } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import headless from "@xterm/headless";
import serialize from "@xterm/addon-serialize";
import * as pty from "node-pty";
import type { Plugin } from "vite";
import { type WebSocket, WebSocketServer } from "ws";
import { labController } from "./app/lab/controller.ts";

/** The most terminals open at once. */
const MAX = 4;

type Client = { ws: WebSocket; pending: string[] | null };
type Session = {
  shell: pty.IPty | null;
  // The shell's command line in the lab, unique so `end` can find this shell and no other.
  tag: string;
  screen: headless.Terminal;
  serializer: serialize.SerializeAddon;
  clients: Set<Client>;
};

/** A shell on the lab, from this computer's own pages only, including a page whose own name was pointed at it. */
export function fromApp(req: IncomingMessage) {
  const host = req.headers.host ?? "";
  const name = host.replace(/:\d+$/, "");
  return req.headers.origin === `http://${host}` && (name === "localhost" || name === "127.0.0.1");
}

/**
 * Serves the lab to every window of the app, through the lab controller (app/lab/controller.ts).
 *
 * ws://<dev server>/events sends the lab's view on connect and on every change, so each page knows
 * at once when a lab starts, stops or Docker goes away.
 *
 * ws://<dev server>/terminal lists the terminal tabs: it sends {tabs: [1, 2], gen} on connect and on
 * every change, and takes {add: true} or {close: id}. `gen` changes whenever the machines are
 * recreated or stopped, which ends every shell and starts the list over at one tab.
 * ws://<dev server>/terminal?id=<id>&gen=<gen> is one tab's shell on base: it sends the screen so far,
 * then the shell's output; it takes {i: keystrokes} or {r: [cols, rows]}. A tab's socket closes with
 * the shell's exit code as the reason when the shell ends, or "gone" when the tab or its gen is gone.
 * Dev server only: `pnpm start` has no terminal.
 */
export function terminal(): Plugin {
  return {
    name: "cka-terminal",
    configureServer(server) {
      // node-pty 1.1.0 ships spawn-helper without its execute bit, and every spawn fails without it.
      const helper = path.join(path.dirname(createRequire(import.meta.url).resolve("node-pty/package.json")), "prebuilds", `${process.platform}-${process.arch}`, "spawn-helper");
      if (fs.existsSync(helper)) fs.chmodSync(helper, 0o755);

      const lab = labController();
      const fake = lab.fake;
      // Shells left in the lab by a server that stopped without ending them.
      if (!fake) execFile("docker", ["exec", "base", "pkill", "-HUP", "-f", "^bash -l -s cka-"], () => {});

      const wss = new WebSocketServer({ noServer: true });
      const sessions = new Map<number, Session>();
      const lists = new Set<WebSocket>();
      const tabs = () => JSON.stringify({ tabs: [...sessions.keys()].sort((a, b) => a - b), gen: lab.gen });
      const announce = () => lists.forEach((l) => l.send(tabs()));
      const attached = () => lab.setAttached([...sessions.values()].reduce((n, s) => n + s.clients.size, 0));

      const add = (id: number) => {
        const screen = new headless.Terminal({ cols: 80, rows: 24, scrollback: 1000, allowProposedApi: true });
        const serializer = new serialize.SerializeAddon();
        screen.loadAddon(serializer);
        const s: Session = { shell: null, tag: "", screen, serializer, clients: new Set() };
        sessions.set(id, s);
        return s;
      };
      const start = (s: Session) => {
        s.tag = `bash -l -s cka-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const { cols, rows } = s.screen;
        const [cmd, args] = fake ? ["bash", ["--norc", "--noprofile", "-i"]] : ["docker", ["exec", "-it", "-e", "TERM=xterm-256color", "base", ...s.tag.split(" ")]];
        const shell = pty.spawn(cmd, args, { name: "xterm-256color", cols, rows, env: process.env as Record<string, string> });
        s.shell = shell;
        s.screen.reset();
        shell.onData((d) => {
          if (s.shell !== shell) return;
          s.screen.write(d);
          for (const c of s.clients) c.pending ? c.pending.push(d) : c.ws.send(d);
        });
        shell.onExit(({ exitCode }) => {
          if (s.shell !== shell) return;
          s.shell = null;
          for (const c of s.clients) c.ws.close(1000, String(exitCode));
        });
      };
      // Stopping `docker exec` leaves its shell running in the lab, so end that shell there too.
      const end = (s: Session) => {
        if (!s.shell) return;
        const old = s.shell;
        s.shell = null;
        old.kill();
        if (!fake) execFile("docker", ["exec", "base", "pkill", "-HUP", "-fx", s.tag], () => {});
      };
      const drop = (id: number) => {
        const s = sessions.get(id)!;
        end(s);
        for (const c of s.clients) c.ws.close(1000, "gone");
        s.screen.dispose();
        sessions.delete(id);
      };
      const close = (id: number) => {
        if (!sessions.has(id) || sessions.size === 1) return;
        drop(id);
        attached();
        announce();
      };
      add(1);
      // The machines are about to be recreated or stopped: every shell on them ends, and the tabs start over.
      lab.onReset(() => {
        [...sessions.keys()].forEach(drop);
        add(1);
        attached();
        announce();
      });

      server.httpServer?.on("close", () => sessions.forEach(end));
      server.httpServer?.on("upgrade", (req, socket, head) => {
        const url = new URL(req.url ?? "", "http://x");
        if (url.pathname !== "/terminal" && url.pathname !== "/events") return; // Vite's own hot-reload socket shares this server.
        if (!fromApp(req)) return socket.destroy();
        const id = url.searchParams.has("id") ? Number(url.searchParams.get("id")) : null;
        if (id !== null && !(Number.isInteger(id) && id >= 1 && id <= MAX)) return socket.destroy();

        wss.handleUpgrade(req, socket, head, (ws) => {
          if (url.pathname === "/events") {
            const off = lab.subscribe((v) => ws.send(JSON.stringify(v)));
            lab.probe();
            ws.on("close", off);
            return;
          }

          // An error thrown in a handler would stop the whole dev server, so a bad message only ends this socket.
          const read = (raw: unknown) => {
            try {
              return JSON.parse(String(raw)) as { i?: string; r?: [number, number]; add?: boolean; close?: number };
            } catch {
              ws.close(1003, "bad message");
              return {};
            }
          };

          if (id === null) {
            lists.add(ws);
            ws.send(tabs());
            ws.on("message", (raw) => {
              const m = read(raw);
              if (m.add && sessions.size < MAX) {
                add([1, 2, 3, 4].find((n) => !sessions.has(n))!);
                announce();
              }
              if (typeof m.close === "number") close(m.close);
            });
            ws.on("close", () => lists.delete(ws));
            return;
          }

          // A tab from before the machines were recreated, or from before a server restart, is gone.
          const s = sessions.get(id);
          if (!s || url.searchParams.get("gen") !== String(lab.gen)) return ws.close(1000, "gone");
          if (!s.shell) start(s);
          // Output that arrives while the screen so far is being drawn waits, so none is lost or doubled.
          const c: Client = { ws, pending: [] };
          s.clients.add(c);
          attached();
          s.screen.write("", () => {
            ws.send(s.serializer.serialize());
            c.pending?.forEach((d) => ws.send(d));
            c.pending = null;
          });
          ws.on("message", (raw) => {
            const m = read(raw);
            if (!s.shell) return;
            if (typeof m.i === "string") {
              s.shell.write(m.i);
              lab.touch();
            }
            if (m.r && m.r[0] > 0 && m.r[1] > 0) {
              s.shell.resize(m.r[0], m.r[1]);
              s.screen.resize(m.r[0], m.r[1]);
            }
          });
          ws.on("close", () => {
            s.clients.delete(c);
            attached();
          });
        });
      });
    },
  };
}
