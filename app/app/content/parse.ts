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
import { INTRO } from "./links";

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

/**
 * One page of a topic in the sidebar. Introduction holds the topic's intro and the sections before the
 * first steps; each Learn page the topic links to follows; then one lesson per section, with a plain
 * section such as Check your work kept on the lesson before it.
 */
export type Lesson = {
  slug: string;
  title: string;
  kind: "intro" | "learn" | "steps" | "recall" | "practice";
  sections: string[];
  stepKeys: string[];
};

/** `lab` is the lab named by the "Starts from the … lab" line; `labHtml` is that line rendered. */
export type Exercise = { title: string; introHtml: string; lab: string | null; labHtml: string; sections: Section[]; lessons: Lesson[] };
export type Summary = { title: string; stepKeys: string[]; recallKeys: string[]; hasPractice: boolean; lab: string | null; lessons: Lesson[] };

/** Reads a Learn page's title from its name; the parser itself never touches the disk. */
export type LearnTitle = (name: string) => string;

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
      if (/^(recall|quiz)/i.test(text)) kind = "recall";
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

function lessonsOf(md: string, sections: Raw[], learnTitle: LearnTitle): Lesson[] {
  const out: Lesson[] = [{ slug: INTRO, title: "Introduction", kind: "intro", sections: [], stepKeys: [] }];
  for (const f of pageLinks(md, "learn")) {
    const name = f.slice("learn/".length, -3);
    out.push({ slug: name, title: learnTitle(name), kind: "learn", sections: [], stepKeys: [] });
  }
  let taught = false;
  for (const s of sections) {
    const stepKeys =
      s.kind === "steps" ? s.nodes.flatMap((n) => (n.type === "list" ? orderedItems(n) : [])).map((_, i) => `${s.slug}#${i + 1}`) : [];
    if (s.kind === "plain" || (s.kind === "steps" && !stepKeys.length && !taught)) {
      (taught ? out.at(-1)! : out[0]).sections.push(s.slug);
      continue;
    }
    taught = true;
    out.push({ slug: s.slug, title: s.title, kind: s.kind, sections: [s.slug], stepKeys });
  }
  return out;
}

export function summarize(md: string, learnTitle: LearnTitle = (n) => n): Summary {
  const { title, intro, sections } = splitSections(md);
  const lessons = lessonsOf(md, sections, learnTitle);
  return {
    title,
    stepKeys: lessons.flatMap((l) => l.stepKeys),
    recallKeys: sections.flatMap((s) => (s.kind === "recall" ? recallKeys(md, s.nodes).map((r) => r.key) : [])),
    hasPractice: sections.some((s) => s.kind === "practice"),
    lab: labOf(intro).lab,
    lessons,
  };
}

/** The "Starts from the [`<lab>` lab](…/lab/labs/<lab>/README.md)" paragraph and the lab it names. */
function labOf(intro: RootContent[]) {
  const labLine = intro.find((n) => n.type === "paragraph" && /^Starts from/.test(toString(n)));
  let lab: string | null = null;
  if (labLine) visit(labLine, "link", (l: { url: string }) => void (lab ??= l.url.match(/lab\/labs\/([\w-]+)\/README\.md/)?.[1] ?? null));
  return { labLine, lab: lab as string | null };
}

// ---------- rendering ----------

const TOPIC_README = /^(\d\d-[^/]+)\/(\d\d-[^/]+)\/README\.md$/;
const LAB_README = /^lab\/labs\/([\w-]+)\/README\.md$/;

/** A page shown inside a topic: the topic's id and the Learn pages that are its lessons. */
export type InTopic = { id: string; learn: string[] };

/**
 * Points links at app routes: topic READMEs to /t/, other Markdown to /doc/, the web to a new tab.
 * Inside a topic, its lab opens the lab panel beside the lesson and its Learn pages open as lessons.
 */
function rewriteLinks({ file, topic }: { file: string; topic?: InTopic }) {
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
      const readme = rel.match(TOPIC_README);
      const learn = rel.match(/^learn\/([\w-]+)\.md$/)?.[1];
      const lab = rel.match(LAB_README);
      if (topic && lab && TOPIC_README.test(file)) el.properties.href = "#lab";
      else if (lab) el.properties.href = `/labs#${lab[1]}`;
      else if (rel === "lab/labs/README.md") el.properties.href = `/labs${suffix}`;
      else if (topic && learn && topic.learn.includes(learn)) el.properties.href = `/t/${topic.id}/${learn}${suffix}`;
      else if (readme) el.properties.href = `/t/${readme[1]}/${readme[2]}${suffix}`;
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

function renderer(file: string, topic?: InTopic) {
  const processor = unified()
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSlug)
    .use(rewriteLinks, { file, topic })
    .use(rehypeShiki, { themes: { light: "github-light", dark: "github-dark-default" }, defaultColor: false })
    .use(rehypeStringify);
  const nodes = async (children: RootContent[]) => {
    if (!children.length) return "";
    const hast = await processor.run({ type: "root", children: mermaidToHtml(children) } as Root);
    return processor.stringify(hast as HastRoot);
  };
  const markdown = (md: string) => nodes((unified().use(remarkParse).use(remarkGfm).parse(md) as Root).children);
  return { nodes, markdown };
}

/** The topic a README belongs to, for rendering its pages as lessons. */
export function inTopic(md: string, file: string): InTopic | undefined {
  const m = file.match(TOPIC_README);
  return m ? { id: `${m[1]}/${m[2]}`, learn: pageLinks(md, "learn").map((f) => f.slice("learn/".length, -3)) } : undefined;
}

/** Parses a README into an Exercise. `file` is its repo-relative path, used to resolve links. */
export async function parseExercise(md: string, file: string, learnTitle: LearnTitle = (n) => n): Promise<Exercise> {
  const { title, intro: introNodes, sections } = splitSections(md);
  const render = renderer(file, inTopic(md, file));
  const { labLine, lab } = labOf(introNodes);
  const intro = introNodes.filter((n) => n !== labLine);
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
  return {
    title,
    introHtml: await render.nodes(intro),
    lab,
    labHtml: labLine ? await render.nodes([labLine]) : "",
    sections: out,
    lessons: lessonsOf(md, sections, learnTitle),
  };
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

/** The `## <name>` section of a page, without its heading, or "" when there is none. */
export function mdSection(md: string, name: string) {
  const m = md.match(new RegExp(`^## ${name}\\n([\\s\\S]*?)(?=^#{1,2} |(?![\\s\\S]))`, "m"));
  return m ? m[1].trim() : "";
}

/** A page without its `# title` line, for showing under a heading of its own. */
export const untitled = (md: string) => md.replace(/^# .*\n+/, "");

/** Repo-relative paths of the pages in `folder` (`references` or `learn`) a README links to, in first-mention order. */
export function pageLinks(md: string, folder: string) {
  return [...new Set([...md.matchAll(new RegExp(`\\]\\((?:\\.\\./)*(${folder}/[\\w-]+\\.md)`, "g"))].map((m) => m[1]))];
}

/**
 * Renders a non-exercise Markdown file (a Learn page, a reference, the lab guide) as one block of HTML,
 * with its `##` headings. `topic` is set when it is shown inside a topic.
 */
export async function renderDoc(md: string, file: string, topic?: InTopic) {
  const { title, sections } = splitSections(md);
  return {
    title,
    headings: sections.map((s) => ({ id: s.slug, text: s.title })),
    html: await renderer(file, topic).markdown(md),
  };
}
