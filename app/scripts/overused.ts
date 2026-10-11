// Lists the words, phrases and sentence openings the learner pages use far more often than
// people writing about the same subject do. The human sample is the Kubernetes docs
// (kubernetes/website, content/en/docs), cloned into app/.cache/k8s-website on the first run.
// A habit that repeats shows up here before anyone has to notice it.
//
// Usage, from app/: node scripts/overused.ts [how many, default 40]
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const SAMPLE = join(ROOT, "app/.cache/k8s-website");
const OURS = ["README.md", "EXAM.md", "lab/README.md", "learn/*.md", "references/*.md", "[0-9][0-9]-*/[0-9][0-9]-*/README.md"];

if (!existsSync(SAMPLE)) {
  const git = (...a: string[]) => execFileSync("git", a, { stdio: "inherit" });
  git("clone", "--depth", "1", "--filter=blob:none", "--sparse", "https://github.com/kubernetes/website.git", SAMPLE);
  git("-C", SAMPLE, "sparse-checkout", "set", "content/en/docs/concepts", "content/en/docs/tasks", "content/en/docs/tutorials");
}

/** The prose of a Markdown page, one sentence per entry, plus its headings and the words in its code. */
function prose(md: string) {
  const code: string[] = [];
  const keep = (text: string) => (code.push(...(text.replace(/(^|\s)#.*$/gm, "").toLowerCase().match(/[a-z]+/g) ?? [])), "");
  md = md
    .replace(/^---\n[\s\S]*?\n---\n/, "")
    .replace(/```[\s\S]*?```/g, keep)
    .replace(/<!--[\s\S]*?-->|\{\{[<%][\s\S]*?[%>]\}\}|<[^>]+>/g, " ")
    .replace(/`[^`\n]*`/g, (c) => (keep(c), " X "))
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ");
  const headings: string[] = [];
  const sentences: string[] = [];
  for (const line of md.split("\n")) {
    const h = line.match(/^#+\s+(.*)/);
    if (h) headings.push(h[1].toLowerCase());
  }
  const body = md.replace(/^#+\s.*$/gm, "\n\n").replace(/^\s*(?:[-*]|\d+\.)\s+/gm, "\n\n").replace(/\|/g, "\n\n");
  for (const para of body.split(/\n\s*\n/)) {
    for (const s of para.replace(/\s+/g, " ").split(/(?<=[.!?:])\s+(?=[A-Z`X])/)) if (s.trim()) sentences.push(s.trim());
  }
  return { headings, sentences, code };
}

const words = (s: string) => s.toLowerCase().replace(/’/g, "'").match(/[a-z][a-z'-]*|\d+/g) ?? [];

/** Every feature of a sentence: its 1- to 4-word phrases, its opening, and how it ends. */
function features(s: string) {
  const w = words(s);
  const out: string[] = [];
  for (let n = 1; n <= 4; n++) for (let i = 0; i + n <= w.length; i++) out.push(w.slice(i, i + n).join(" "));
  if (w.length) out.push(`[opens] ${w.slice(0, 2).join(" ")}`, `[opens] ${w[0]}`);
  if (/:$/.test(s)) out.push("[ends with a colon]");
  if (/, which [^,]*\.$/.test(s)) out.push("[ends with ', which …']");
  return out;
}

function corpus(files: string[]) {
  const counts = new Map<string, number>();
  const pages = new Map<string, Set<string>>();
  const code = new Map<string, number>();
  let total = 0;
  for (const f of files) {
    const p = prose(readFileSync(f, "utf8"));
    p.code.forEach((w) => code.set(w, (code.get(w) ?? 0) + 1));
    const add = (k: string) => {
      counts.set(k, (counts.get(k) ?? 0) + 1);
      (pages.get(k) ?? pages.set(k, new Set()).get(k)!).add(f);
    };
    for (const s of p.sentences) {
      total += words(s).length;
      features(s).forEach(add);
    }
    for (const h of p.headings) words(h).forEach((w) => add(`[heading] ${w}`));
  }
  return { counts, pages, code, total };
}

const ours = corpus(OURS.flatMap((g) => globSync(g, { cwd: ROOT }).map((f) => join(ROOT, f))));
const theirs = corpus(globSync("content/en/docs/**/*.md", { cwd: SAMPLE }).map((f) => join(SAMPLE, f)));

// Log-odds ratio with an informative prior (Monroe, Colaresi and Quinn, "Fightin' Words", 2008):
// a z-score per feature, so a phrase needs both a large gap and enough uses to rank high.
const prior = 0.01;
const z = (k: string) => {
  const a = ours.counts.get(k) ?? 0, b = theirs.counts.get(k) ?? 0;
  const p = prior * (a + b + 1);
  const la = Math.log((a + p) / (ours.total + prior * ours.total - a - p));
  const lb = Math.log((b + p) / (theirs.total + prior * theirs.total - b - p));
  return (la - lb) / Math.sqrt(1 / (a + p) + 1 / (b + p));
};

// Leave out the subject: phrases made only of words our commands and code use often, such as `pod`.
const inCode = (w: string) => (ours.code.get(w) ?? 0) >= 3 && (ours.code.get(w) ?? 0) * 5 >= (ours.counts.get(w) ?? 0);
const subject = (k: string) => !k.startsWith("[") && words(k).every(inCode);

const rows = [...ours.counts.keys()]
  .filter((k) => ours.pages.get(k)!.size >= 4 && !subject(k))
  .map((k) => {
    const a = ours.counts.get(k)!, b = theirs.counts.get(k) ?? 0;
    return { k, z: z(k), ours: (a / ours.total) * 1000, theirs: (b / theirs.total) * 1000, pages: ours.pages.get(k)!.size };
  })
  .filter((r) => r.ours > 2 * r.theirs)
  .sort((x, y) => y.z - x.z);

const args = process.argv.slice(2);
const show = args[0] === "--show" ? args.slice(1) : null;
console.log(`ours: ${ours.total} words; Kubernetes docs: ${theirs.total} words\n`);
console.log("per 1,000 words".padStart(58));
console.log("phrase".padEnd(40), "ours".padStart(8), "theirs".padStart(8), "pages".padStart(6));
const print = (k: string) => {
  const rate = (c: { counts: Map<string, number>; total: number }) => (((c.counts.get(k) ?? 0) / c.total) * 1000).toFixed(2).padStart(8);
  console.log(k.padEnd(40), rate(ours), rate(theirs), String(ours.pages.get(k)?.size ?? 0).padStart(6));
};
(show ?? rows.slice(0, Number(args[0] ?? 40)).map((r) => r.k)).forEach(print);
