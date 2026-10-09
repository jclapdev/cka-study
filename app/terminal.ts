import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import * as pty from "node-pty";
import type { Plugin } from "vite";
import { type WebSocket, WebSocketServer } from "ws";

/**
 * Serves a shell on base, the machine the exam starts you on, at ws://<dev server>/terminal. The browser
 * sends {i: keystrokes} or {r: [cols, rows]}; the shell's output comes back as text. Every window shares one
 * shell that outlives its windows, so a popped-out terminal carries on where the pane left off.
 * /terminal?new swaps it for a fresh one.
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
      const clients = new Set<WebSocket>();
      let shell: pty.IPty | null = null;
      // ponytail: raw tail, so a cut inside a color code can garble the first replayed line; use @xterm/addon-serialize if it shows.
      let out = "";
      const start = () => {
        const s = pty.spawn("docker", ["exec", "-it", "-e", "TERM=xterm-256color", "base", "bash", "-l"], { name: "xterm-256color", cols: 80, rows: 24, env: process.env as Record<string, string> });
        shell = s;
        out = "";
        s.onData((d) => {
          if (shell !== s) return;
          out = (out + d).slice(-100_000);
          for (const c of clients) c.send(d);
        });
        s.onExit(({ exitCode }) => {
          if (shell !== s) return;
          shell = null;
          for (const c of clients) c.close(1000, String(exitCode));
        });
      };

      server.httpServer?.on("close", () => shell?.kill());
      server.httpServer?.on("upgrade", (req, socket, head) => {
        if (req.url !== "/terminal" && req.url !== "/terminal?new") return; // Vite's own hot-reload socket shares this server.
        // A shell on the lab: refuse pages from any other site, including one whose own name
        // was pointed at this computer, which sends a matching Origin and Host.
        const host = req.headers.host?.replace(/:\d+$/, "");
        if (req.headers.origin !== `http://${req.headers.host}` || (host !== "localhost" && host !== "127.0.0.1")) return socket.destroy();
        wss.handleUpgrade(req, socket, head, (ws) => {
          if (req.url === "/terminal?new" && shell) {
            const old = shell;
            shell = null;
            old.kill();
            for (const c of clients) c.send("\x1bc"); // Other windows clear and carry on in the fresh shell.
          }
          if (!shell) start();
          ws.send(out);
          clients.add(ws);
          // An error thrown here would stop the whole dev server, so a bad message only ends this session.
          ws.on("message", (raw) => {
            if (!shell) return;
            try {
              const m = JSON.parse(String(raw)) as { i?: string; r?: [number, number] };
              if (typeof m.i === "string") shell.write(m.i);
              if (m.r && m.r[0] > 0 && m.r[1] > 0) shell.resize(m.r[0], m.r[1]);
            } catch {
              ws.close(1003, "bad message");
            }
          });
          ws.on("close", () => clients.delete(ws));
        });
      });
    },
  };
}
