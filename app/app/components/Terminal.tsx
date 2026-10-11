import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, useState } from "react";

/**
 * One terminal tab: a shell on base, the machine the exam starts you on. Copy and paste use the exam
 * terminal's keys, Ctrl+Shift+C and Ctrl+Shift+V, or the right-click menu. Every tab stays mounted;
 * `active` is the one showing.
 */
export function Terminal({ id, gen, active }: { id: number; gen: number; active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const fitRef = useRef<() => void>(() => {});
  const termRef = useRef<import("@xterm/xterm").Terminal | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; selection: string } | null>(null);

  useEffect(() => {
    let dispose = () => {};
    let cancelled = false;
    Promise.all([import("@xterm/xterm"), import("@xterm/addon-fit")]).then(([{ Terminal: XTerm }, { FitAddon }]) => {
      if (cancelled || !ref.current) return;
      // The colours follow the system's dark mode, also when it changes while the terminal is open.
      const scheme = matchMedia("(prefers-color-scheme: dark)");
      const theme = () => (scheme.matches ? { background: "#0b0e13" } : { background: "#1b2433", foreground: "#e3e8ef" });
      const term = new XTerm({
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 14,
        cursorBlink: true,
        theme: theme(),
      });
      const recolour = () => (term.options.theme = theme());
      scheme.addEventListener("change", recolour);
      termRef.current = term;
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(ref.current);

      let ws: WebSocket;
      let ended = false;
      let retry = 0;
      let dropped = false;
      const send = (m: object) => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify(m));
      // A tab that isn't showing keeps its size; fitting it would squeeze the shell to nothing. Two
      // windows can show the same shell, so only the one in use sets its size, and takes it back on focus.
      const resize = () => {
        if (!ref.current?.checkVisibility({ visibilityProperty: true })) return;
        fit.fit();
        if (document.hasFocus()) send({ r: [term.cols, term.rows] });
      };
      addEventListener("focus", resize);
      fitRef.current = resize;
      const connect = () => {
        ws = new WebSocket(`ws://${location.host}/terminal?id=${id}&gen=${gen}`);
        // The server sends the whole screen first, so start from a clean one.
        ws.onopen = () => {
          dropped = false;
          term.reset();
          resize();
        };
        ws.onmessage = (e) => term.write(e.data as string);
        // The server closes with the shell's exit code as the reason when the shell ends, and "gone"
        // when the tab was closed or the lab started over, when the panel brings new tabs. No reason
        // means the connection dropped: try again.
        ws.onclose = (e) => {
          if (e.reason === "gone") return;
          if (e.reason) {
            ended = true;
            term.write("\r\n\x1b[2mSession ended. Press Enter to start a new one.\x1b[0m\r\n");
            return;
          }
          if (!dropped) term.write("\r\n\x1b[2mReconnecting…\x1b[0m\r\n");
          dropped = true;
          retry = window.setTimeout(() => {
            retry = 0;
            connect();
          }, 1000);
        };
      };
      connect();
      term.onData((i) => {
        if (!ended) return send({ i });
        if (i !== "\r") return;
        ended = false;
        connect();
      });
      term.attachCustomKeyEventHandler((e) => {
        if (e.type !== "keydown" || !e.ctrlKey || !e.shiftKey) return true;
        if (e.code === "KeyC") navigator.clipboard.writeText(term.getSelection());
        else if (e.code === "KeyV") navigator.clipboard.readText().then((t) => t && term.paste(t));
        else return true;
        e.preventDefault();
        return false;
      });
      const observer = new ResizeObserver(resize);
      observer.observe(ref.current);

      dispose = () => {
        clearTimeout(retry);
        observer.disconnect();
        removeEventListener("focus", resize);
        scheme.removeEventListener("change", recolour);
        ws.onclose = null;
        ws.close();
        term.dispose();
        termRef.current = null;
      };
    });
    return () => {
      cancelled = true;
      dispose();
    };
  }, [id, gen]);

  useEffect(() => {
    if (!active) return setMenu(null);
    fitRef.current();
    termRef.current?.focus();
  }, [active]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    addEventListener("pointerdown", close);
    addEventListener("keydown", close);
    addEventListener("blur", close);
    return () => {
      removeEventListener("pointerdown", close);
      removeEventListener("keydown", close);
      removeEventListener("blur", close);
    };
  }, [menu]);

  const item = "block w-full px-4 py-1.5 text-left hover:bg-paper disabled:text-muted disabled:hover:bg-transparent";
  return (
    <div className={`absolute inset-0 bg-[#1b2433] p-2 dark:bg-[#0b0e13] ${active ? "" : "invisible"}`}>
      <div
        ref={ref}
        className="h-full"
        onContextMenu={(e) => {
          e.preventDefault();
          const box = e.currentTarget.parentElement!.getBoundingClientRect();
          setMenu({ x: e.clientX - box.left, y: e.clientY - box.top, selection: termRef.current?.getSelection() ?? "" });
        }}
      />
      {menu && (
        <div
          role="menu"
          style={{ left: menu.x, top: menu.y }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute z-10 min-w-36 rounded border border-line bg-surface py-1 text-sm text-ink shadow-lg"
        >
          <button
            role="menuitem"
            disabled={!menu.selection}
            onClick={() => {
              navigator.clipboard.writeText(menu.selection);
              setMenu(null);
              termRef.current?.focus();
            }}
            className={item}
          >
            Copy
          </button>
          <button
            role="menuitem"
            onClick={() => {
              navigator.clipboard.readText().then((t) => t && termRef.current?.paste(t));
              setMenu(null);
              termRef.current?.focus();
            }}
            className={item}
          >
            Paste
          </button>
        </div>
      )}
    </div>
  );
}
