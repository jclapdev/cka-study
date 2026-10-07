import fs from "node:fs";
import path from "node:path";

// The app runs from app/, so the exercises are one level up.
export const REPO = path.resolve(process.env.CKA_REPO ?? path.join(process.cwd(), ".."));

const NUMBERED = /^\d\d-[a-z0-9-]+$/;

export type Topic = { domain: string; topic: string; id: string; name: string; written: boolean };
export type Domain = { name: string; weight: number | null; topics: Topic[] };

/**
 * Every domain and topic, named and ordered as the Exercises table in the root README lists them.
 * A domain row reads `| Name (25%) | [Topic](<domain>/<topic>…) | status |`, and each row after it
 * with an empty first cell adds a topic.
 */
export function listDomains(): Domain[] {
  const readme = fs.readFileSync(path.join(REPO, "README.md"), "utf8");
  const domains: Domain[] = [];
  for (const [, first, second] of readme.matchAll(/^\| (.*?) ?\| (.*?) \|.*\|$/gm)) {
    if (first === "Domain" || first.startsWith("---")) continue;
    if (first) {
      const m = first.match(/^(.+?)(?: \((\d+)%\))?$/)!;
      domains.push({ name: m[1], weight: m[2] ? Number(m[2]) : null, topics: [] });
    }
    const link = second.match(/^\[(.+)\]\((\d\d-[a-z0-9-]+)\/(\d\d-[a-z0-9-]+)/);
    if (!link || !domains.length) continue;
    const [, name, domain, topic] = link;
    domains.at(-1)!.topics.push({
      domain,
      topic,
      id: `${domain}/${topic}`,
      name,
      written: fs.existsSync(path.join(REPO, domain, topic, "README.md")),
    });
  }
  return domains;
}

/** Repo-relative path of a topic's README, or null when the topic does not exist. */
export function topicReadme(domain: string, topic: string): string | null {
  if (!NUMBERED.test(domain) || !NUMBERED.test(topic)) return null;
  const rel = `${domain}/${topic}/README.md`;
  return fs.existsSync(path.join(REPO, rel)) ? rel : null;
}

/** Whether a topic has a grade.sh for its Practice section. */
export function hasGrader(domain: string, topic: string): boolean {
  return NUMBERED.test(domain) && NUMBERED.test(topic) && fs.existsSync(path.join(REPO, domain, topic, "grade.sh"));
}

/**
 * Reads a Markdown file by repo-relative path. Returns null for anything that
 * is not a .md file inside the repo, or that lives in the app itself.
 */
export function readMarkdown(rel: string): string | null {
  const abs = path.resolve(REPO, rel);
  const inside = path.relative(REPO, abs);
  if (inside.startsWith("..") || path.isAbsolute(inside)) return null;
  if (!abs.endsWith(".md") || inside.split(path.sep)[0] === "app") return null;
  try {
    return fs.readFileSync(abs, "utf8");
  } catch {
    return null;
  }
}

export type Lab = { name: string; from: string | null; md: string };

/** Every lab folder in lab/labs, each lab after the one it builds on. lab/lab.sh reads the same "Builds on" line. */
export function listLabs(): Lab[] {
  const dir = path.join(REPO, "lab/labs");
  if (!fs.existsSync(dir)) return [];
  const labs = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(dir, d.name, "README.md")))
    .map((d): Lab => {
      const md = fs.readFileSync(path.join(dir, d.name, "README.md"), "utf8");
      return { name: d.name, from: md.match(/^Builds on the \[`([a-z0-9-]+)` lab\]/m)?.[1] ?? null, md };
    });
  const depth = (l: Lab, seen = 0): number => {
    const parent = labs.find((p) => p.name === l.from);
    return parent && seen < labs.length ? 1 + depth(parent, seen + 1) : 0;
  };
  return labs.sort((a, b) => depth(a) - depth(b) || a.name.localeCompare(b.name));
}

/** A Learn page's `# title`, or its name when the page is missing. */
export const learnTitle = (name: string) => readMarkdown(`learn/${name}.md`)?.match(/^# (.+)$/m)?.[1] ?? name;
