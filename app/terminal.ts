import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import * as pty from "node-pty";
import type { Plugin } from "vite";
import { WebSocketServer } from "ws";

/**
 * Serves a shell on base, the machine the exam starts you on, at ws://<dev server>/terminal. The browser
 * sends {i: keystrokes} or {r: [cols, rows]}; the shell's output comes back as text.
 * Dev server only: `pnpm start` has no terminal.
 */
export function terminal(): Plugin {
  return {
    name: "cka-terminal",
    configureServer(server) {
      // node-pty 1.1.0 ships spawn-helper without its execute bit, and every spawn fails without it.
      const helper = path.join(path.dirname(createRequire(import.meta.url).resolve("node-pty/package.json")), "prebuilds", `${process.platform}-${process.arch}`, "spawn-helper");
      if (fs.existsSync(helper)) fs.chmodSync(helper, 0o755);

      const wss = new WebSocketServer({ noServer: true });
      server.httpServer?.on("upgrade", (req, socket, head) => {
        if (req.url !== "/terminal") return; // Vite's own hot-reload socket shares this server.
        // A shell on the lab: refuse pages from any other site.
        if (req.headers.origin !== `http://${req.headers.host}`) return socket.destroy();
        wss.handleUpgrade(req, socket, head, (ws) => {
          const shell = pty.spawn("limactl", ["shell", "base"], { name: "xterm-256color", cols: 80, rows: 24, env: process.env as Record<string, string> });
          let exited = false;
          shell.onData((d) => ws.send(d));
          shell.onExit(({ exitCode }) => {
            exited = true;
            ws.close(1000, String(exitCode));
          });
          // An error thrown here would stop the whole dev server, so a bad message only ends this session.
          ws.on("message", (raw) => {
            if (exited) return;
            try {
              const m = JSON.parse(String(raw)) as { i?: string; r?: [number, number] };
              if (typeof m.i === "string") shell.write(m.i);
              if (m.r && m.r[0] > 0 && m.r[1] > 0) shell.resize(m.r[0], m.r[1]);
            } catch {
              ws.close(1003, "bad message");
            }
          });
          ws.on("close", () => exited || shell.kill());
        });
      });
    },
  };
}
