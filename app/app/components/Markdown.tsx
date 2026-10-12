import { useEffect, useRef } from "react";

/** Server-rendered README HTML, with a copy button on each code block and Mermaid drawn in the browser. */
export function Markdown({ html, className = "" }: { html: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    // Copy goes on what the reader runs or pastes: blocks with a language, which Shiki highlights.
    // Output blocks have no language and stay plain <pre>.
    for (const pre of root.querySelectorAll<HTMLPreElement>("pre.shiki")) {
      if (pre.querySelector(".copy-btn")) continue;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "copy-btn";
      btn.textContent = "Copy";
      btn.onclick = async () => {
        await navigator.clipboard.writeText(pre.querySelector("code")?.innerText ?? pre.innerText);
        btn.textContent = "Copied";
        setTimeout(() => (btn.textContent = "Copy"), 1200);
      };
      pre.append(btn);
    }
    // Diagrams follow the system's dark mode, and are drawn again from their source when it changes.
    const diagrams = [...root.querySelectorAll<HTMLElement>("pre.mermaid")];
    if (!diagrams.length) return;
    const scheme = matchMedia("(prefers-color-scheme: dark)");
    // A lesson left before Mermaid loads takes its diagrams off the page; drawing those throws.
    let gone = false;
    const draw = () =>
      import("mermaid").then(({ default: mermaid }) => {
        const nodes = diagrams.filter((d) => d.isConnected);
        if (gone || !nodes.length) return;
        for (const d of nodes) {
          d.dataset.source ??= d.textContent ?? "";
          d.textContent = d.dataset.source;
          d.removeAttribute("data-processed");
        }
        mermaid.initialize({ startOnLoad: false, theme: scheme.matches ? "dark" : "neutral" });
        mermaid.run({ nodes, suppressErrors: true });
      });
    draw();
    scheme.addEventListener("change", draw);
    return () => {
      gone = true;
      scheme.removeEventListener("change", draw);
    };
  }, [html]);

  return <div ref={ref} className={`md ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
