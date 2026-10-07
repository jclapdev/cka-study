import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, useState } from "react";

/** A shell on base, the machine the exam starts you on. Copy and paste use the exam terminal's keys, Ctrl+Shift+C and Ctrl+Shift+V. */
export function Terminal({ onReset, onPopOut }: { onReset: () => void; onPopOut?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let dispose = () => {};
    let cancelled = false;
    setFailed(false);
    Promise.all([import("@xterm/xterm"), import("@xterm/addon-fit")]).then(([{ Terminal: XTerm }, { FitAddon }]) => {
      if (cancelled || !ref.current) return;
      const dark = matchMedia("(prefers-color-scheme: dark)").matches;
      const term = new XTerm({
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 14,
        cursorBlink: true,
        theme: dark ? { background: "#0b0e13" } : { background: "#1b2433", foreground: "#e3e8ef" },
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(ref.current);

      const ws = new WebSocket(`ws://${location.host}/terminal`);
      const send = (m: object) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(m));
      // A hidden lab pane is a sliver; fitting to it would squeeze the shell to two columns.
      const resize = () => {
        if (!ref.current?.checkVisibility({ visibilityProperty: true })) return;
        fit.fit();
        send({ r: [term.cols, term.rows] });
      };
      ws.onopen = resize;
      ws.onmessage = (e) => term.write(e.data as string);
      // The server closes with the shell's exit code as the reason. `exit` gives 0; a stopped
      // machine or a dead dev server gives anything else.
      ws.onclose = (e) => {
        term.write("\r\n\x1b[2m[session ended]\x1b[0m\r\n");
        setFailed(e.reason !== "0");
      };
      term.onData((i) => send({ i }));
      term.attachCustomKeyEventHandler((e) => {
        if (e.type !== "keydown" || !e.ctrlKey || !e.shiftKey) return true;
        if (e.code === "KeyC") navigator.clipboard.writeText(term.getSelection());
        else if (e.code === "KeyV") navigator.clipboard.readText().then((t) => term.paste(t));
        else return true;
        e.preventDefault();
        return false;
      });
      const observer = new ResizeObserver(resize);
      observer.observe(ref.current);
      term.focus();

      dispose = () => {
        observer.disconnect();
        ws.onclose = null;
        ws.close();
        term.dispose();
      };
    });
    return () => {
      cancelled = true;
      dispose();
    };
  }, [session]);

  return (
    <div className="flex h-full flex-col bg-[#1b2433] dark:bg-[#0b0e13]">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-sm text-[#e3e8ef]">
        <span className="font-semibold">Terminal</span>
        {failed && <span className="text-[#8b97a8]">Disconnected.</span>}
        <button onClick={() => setSession((s) => s + 1)} className="ml-auto rounded border border-white/20 px-2 py-1 hover:border-white/60">
          New session
        </button>
        {onPopOut && (
          <button onClick={onPopOut} className="rounded border border-white/20 px-2 py-1 hover:border-white/60">
            Pop out
          </button>
        )}
        <button onClick={onReset} className="rounded border border-white/20 px-2 py-1 hover:border-white/60">
          Reset
        </button>
      </div>
      <div ref={ref} className="min-h-0 flex-1 p-2" />
    </div>
  );
}
