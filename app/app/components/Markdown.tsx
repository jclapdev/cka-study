import { useEffect, useRef } from "react";

/** Server-rendered README HTML, with a copy button on each code block and Mermaid drawn in the browser. */
export function Markdown({ html, className = "" }: { html: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    for (const pre of root.querySelectorAll<HTMLPreElement>("pre:not(.mermaid)")) {
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
    const diagrams = root.querySelectorAll<HTMLElement>("pre.mermaid:not([data-processed])");
    if (diagrams.length)
      import("mermaid").then(({ default: mermaid }) => {
        const dark = matchMedia("(prefers-color-scheme: dark)").matches;
        mermaid.initialize({ startOnLoad: false, theme: dark ? "dark" : "neutral" });
        mermaid.run({ nodes: [...diagrams] });
      });
  }, [html]);

  return <div ref={ref} className={`md ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
