import path from "node:path";
import GithubSlugger from "github-slugger";
import type { Element, Root as HastRoot } from "hast";
import type { Html, List, ListItem, Paragraph, Root, RootContent } from "mdast";
import { toString } from "mdast-util-to-string";
import rehypeRaw from "rehype-raw";
import rehypeShiki from "@shikijs/rehype";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";

export type Step = { key: string; label: number; html: string };
export type Block = { html: string } | { steps: Step[] };
export type RecallItem = { key: string; question: string; answerHtml: string };
export type Task = { n: number; hosts: string[]; weight: number; html: string };

export type Section =
  | { kind: "steps"; slug: string; title: string; blocks: Block[] }
  | { kind: "recall"; slug: string; title: string; items: RecallItem[] }
  | {
      kind: "practice";
      slug: string;
      title: string;
      minutes: number | null;
      introHtml: string;
      tasks: Task[];
      solutionHtml: string;
    }
  | { kind: "plain"; slug: string; title: string; html: string };

/** `lab` is the starting state named by the "Starts from the … lab" line; `labHtml` is that line rendered. */
export type Exercise = { title: string; introHtml: string; lab: string | null; labHtml: string; sections: Section[] };
export type Summary = { title: string; stepKeys: string[]; recallKeys: string[]; hasPractice: boolean };

type Raw = { slug: string; title: string; kind: Section["kind"]; nodes: RootContent[] };

// ---------- structure (no rendering) ----------

function splitSections(md: string) {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(md) as Root;
  const slugger = new GithubSlugger();
  let title = "";
  const intro: RootContent[] = [];
  const sections: Raw[] = [];
  let taught = true; // sections before Recall / Practice / Check teach, and carry steps

  for (const node of tree.children) {
    if (node.type === "heading" && node.depth === 1 && !title) {
      title = toString(node);
    } else if (node.type === "heading" && node.depth === 2) {
      const text = toString(node);
      const slug = slugger.slug(text);
      let kind: Section["kind"] = "plain";
      if (/^recall/i.test(text)) kind = "recall";
      else if (/^practice/i.test(text)) kind = "practice";
      if (kind !== "plain" || /^check your work/i.test(text)) taught = false;
      else if (taught) kind = "steps";
      sections.push({ slug, title: text, kind, nodes: [] });
    } else if (sections.length) {
      sections.at(-1)!.nodes.push(node);
    } else {
      intro.push(node);
    }
  }
  return { title, intro, sections };
}

/** Splits <details><summary>…</summary>…</details> blocks out of a node list. */
function detailsBlocks(md: string, nodes: RootContent[]) {
  const found: { summary: string; body: string }[] = [];
  const rest: RootContent[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type !== "html" || !node.value.trimStart().startsWith("<details")) {
      rest.push(node);
      continue;
    }
    let j = i;
    while (j < nodes.length && !(nodes[j].type === "html" && (nodes[j] as Html).value.includes("</details>"))) j++;
    const end = nodes[Math.min(j, nodes.length - 1)];
    const source = md.slice(node.position!.start.offset, end.position!.end.offset);
    const m = source.match(/<details>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/);
    if (m) found.push({ summary: m[1].trim(), body: m[2] });
    i = j;
  }
  return { found, rest };
}

const orderedItems = (list: List) => (list.ordered ? list.children : []);

function recallKeys(md: string, nodes: RootContent[]) {
  const slugger = new GithubSlugger();
  return detailsBlocks(md, nodes).found.map((d) => ({ ...d, key: slugger.slug(d.summary) }));
}

export function summarize(md: string): Summary {
  const { title, sections } = splitSections(md);
  const stepKeys: string[] = [];
  const keys: string[] = [];
  for (const s of sections) {
    if (s.kind === "steps") {
      let n = 0;
      for (const node of s.nodes)
        if (node.type === "list") for (const _ of orderedItems(node)) stepKeys.push(`${s.slug}#${++n}`);
    }
    if (s.kind === "recall") keys.push(...recallKeys(md, s.nodes).map((r) => r.key));
  }
  return { title, stepKeys, recallKeys: keys, hasPractice: sections.some((s) => s.kind === "practice") };
}

// ---------- rendering ----------

const TOPIC_README = /^(\d\d-[^/]+)\/(\d\d-[^/]+)\/README\.md$/;

/**
 * Points links at app routes: topic READMEs to /t/, other Markdown to /doc/, the web to a new tab.
 * `inTopic` is true for anything shown on a topic page, where the lab guide and references open in its tabs.
 */
function rewriteLinks({ file, inTopic }: { file: string; inTopic: boolean }) {
  return (tree: HastRoot) => {
    visit(tree, "element", (el: Element) => {
      if (el.tagName === "blockquote") return callout(el);
      if (el.tagName !== "a" || typeof el.properties.href !== "string") return;
      const href = el.properties.href;
      if (/^https?:/.test(href)) {
        el.properties.target = "_blank";
        el.properties.rel = ["noreferrer"];
        return;
      }
      if (href.startsWith("#")) return;
      const [p, hash] = href.split("#");
      const rel = path.posix.normalize(path.posix.join(path.posix.dirname(file), p));
      const suffix = hash ? `#${hash}` : "";
      const topic = rel.match(TOPIC_README);
      const ref = rel.match(/^references\/([\w-]+)\.md$/);
      if (inTopic && rel === "lab/README.md") el.properties.href = "?tab=lab";
      else if (inTopic && ref && ref[1] !== "README") el.properties.href = `?tab=references&ref=${ref[1]}${suffix}`;
      else if (topic) el.properties.href = `/t/${topic[1]}/${topic[2]}${suffix}`;
      else if (rel.endsWith(".md")) el.properties.href = `/doc/${rel}${suffix}`;
    });
  };
}

/** Turns a GitHub alert (a blockquote opening with [!note]) into a labelled callout. */
function callout(el: Element) {
  const p = el.children.find((c): c is Element => c.type === "element" && c.tagName === "p");
  const text = p?.children[0];
  if (text?.type !== "text") return;
  const m = text.value.match(/^\[!(\w+)\]\s*/);
  if (!m) return;
  text.value = text.value.slice(m[0].length);
  const label = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
  p!.children.unshift({ type: "element", tagName: "span", properties: { className: ["callout-label"] }, children: [{ type: "text", value: label }] });
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Mermaid blocks become <pre class="mermaid"> so Shiki leaves them for the browser to draw. */
function mermaidToHtml(nodes: RootContent[]): RootContent[] {
  return nodes.map((n) =>
    n.type === "code" && n.lang === "mermaid"
      ? ({ type: "html", value: `<pre class="mermaid">${escapeHtml(n.value)}</pre>` } as Html)
      : n,
  );
}

function renderer(file: string, inTopic = TOPIC_README.test(file)) {
  const processor = unified()
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSlug)
    .use(rewriteLinks, { file, inTopic })
    .use(rehypeShiki, { themes: { light: "github-light", dark: "github-dark" }, defaultColor: false })
    .use(rehypeStringify);
  const nodes = async (children: RootContent[]) => {
    if (!children.length) return "";
    const hast = await processor.run({ type: "root", children: mermaidToHtml(children) } as Root);
    return processor.stringify(hast as HastRoot);
  };
  const markdown = (md: string) => nodes((unified().use(remarkParse).use(remarkGfm).parse(md) as Root).children);
  return { nodes, markdown };
}

/** Parses a README into an Exercise. `file` is its repo-relative path, used to resolve links. */
export async function parseExercise(md: string, file: string): Promise<Exercise> {
  const { title, intro: introNodes, sections } = splitSections(md);
  const render = renderer(file);
  const labLine = introNodes.find((n) => n.type === "paragraph" && /^Starts from/.test(toString(n)));
  const intro = introNodes.filter((n) => n !== labLine);
  let lab: string | null = null;
  if (labLine) visit(labLine, "link", (l: { url: string }) => void (lab ??= l.url.match(/lab\/README\.md#([\w-]+)/)?.[1] ?? null));
  const out: Section[] = [];

  for (const s of sections) {
    const base = { slug: s.slug, title: s.title };

    if (s.kind === "steps") {
      const blocks: Block[] = [];
      let pending: RootContent[] = [];
      let n = 0;
      const flush = async () => {
        if (pending.length) blocks.push({ html: await render.nodes(pending) });
        pending = [];
      };
      for (const node of s.nodes) {
        if (node.type === "list" && node.ordered) {
          await flush();
          const start = node.start ?? 1;
          const steps: Step[] = [];
          for (const [i, item] of node.children.entries())
            steps.push({ key: `${s.slug}#${++n}`, label: start + i, html: await render.nodes(item.children) });
          blocks.push({ steps });
        } else pending.push(node);
      }
      await flush();
      out.push({ kind: "steps", ...base, blocks });
    } else if (s.kind === "recall") {
      const items: RecallItem[] = [];
      for (const r of recallKeys(md, s.nodes))
        items.push({ key: r.key, question: r.summary, answerHtml: await render.markdown(r.body) });
      out.push({ kind: "recall", ...base, items });
    } else if (s.kind === "practice") {
      const { found, rest } = detailsBlocks(md, s.nodes);
      const introNodes = rest.filter((n) => !(n.type === "list" && n.ordered));
      const list = rest.find((n): n is List => n.type === "list" && !!n.ordered);
      const budget = introNodes.map((n) => toString(n)).join(" ").match(/(\d+)\s*minutes/);
      const tasks: Task[] = [];
      for (const [i, item] of (list?.children ?? []).entries()) tasks.push(await task(item, i + 1, render.nodes));
      out.push({
        kind: "practice",
        ...base,
        minutes: budget ? Number(budget[1]) : null,
        introHtml: await render.nodes(introNodes),
        tasks,
        solutionHtml: found.length ? await render.markdown(found.map((f) => f.body).join("\n")) : "",
      });
    } else {
      out.push({ kind: "plain", ...base, html: await render.nodes(s.nodes) });
    }
  }
  return { title, introHtml: await render.nodes(intro), lab, labHtml: labLine ? await render.nodes([labLine]) : "", sections: out };
}

/** Reads "**Host `x`, weight 19%.**" off the front of a task and renders the rest. */
async function task(item: ListItem, n: number, render: (c: RootContent[]) => Promise<string>): Promise<Task> {
  const [first, ...others] = item.children;
  let hosts: string[] = [];
  let weight = 0;
  let children = item.children as RootContent[];
  if (first?.type === "paragraph" && first.children[0]?.type === "strong") {
    const m = toString(first.children[0]).match(/^Hosts?\s+(.+?),\s*weight\s+(\d+)%/i);
    if (m) {
      hosts = m[1].split(/,\s*|\s+and\s+/).filter(Boolean);
      weight = Number(m[2]);
      const para: Paragraph = { ...first, children: first.children.slice(1) };
      const lead = para.children[0];
      if (lead?.type === "text") para.children[0] = { ...lead, value: lead.value.trimStart() };
      children = [para, ...others];
    }
  }
  return { n, hosts, weight, html: await render(children) };
}

/** The `### <name>` section of the lab guide, without its heading, or "" when there is none. */
export function labSection(labMd: string, name: string) {
  const m = labMd.match(new RegExp(`^### ${name}\\n([\\s\\S]*?)(?=^##? |^### |(?![\\s\\S]))`, "m"));
  return m ? m[1].trim() : "";
}

/** Repo-relative paths of the reference pages a README links to, in first-mention order. */
export function referenceLinks(md: string) {
  return [...new Set([...md.matchAll(/\]\((?:\.\.\/)*(references\/[\w-]+\.md)/g)].map((m) => m[1]))];
}

/**
 * Renders a non-exercise Markdown file (a reference, the lab guide) as one block of HTML,
 * with its `##` headings for an "On this page" list. `inTopic` is true when it is shown on a topic page.
 */
export async function renderDoc(md: string, file: string, inTopic = false) {
  const { title, sections } = splitSections(md);
  return {
    title,
    headings: sections.map((s) => ({ id: s.slug, text: s.title })),
    html: await renderer(file, inTopic).markdown(md),
  };
}

/** The one-line "Covers" text for each reference, read from the table in references/README.md. */
export function referenceCovers(indexMd: string): Record<string, string> {
  return Object.fromEntries(
    [...indexMd.matchAll(/^\| \[[^\]]+\]\(([\w-]+)\.md\) \| (.+?) \|$/gm)].map((m) => [m[1], m[2].replace(/`/g, "")]),
  );
}
