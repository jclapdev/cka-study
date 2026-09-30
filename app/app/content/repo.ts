import fs from "node:fs";
import path from "node:path";

// The app runs from app/, so the exercises are one level up.
export const REPO = path.resolve(process.env.CKA_REPO ?? path.join(process.cwd(), ".."));

const NUMBERED = /^\d\d-[a-z0-9-]+$/;

export type Topic = { domain: string; topic: string; id: string; written: boolean };
export type Domain = { name: string; weight: number | null; topics: Topic[] };

function dirs(dir: string) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && NUMBERED.test(d.name))
    .map((d) => d.name)
    .sort();
}

export function listDomains(): Domain[] {
  const readme = fs.readFileSync(path.join(REPO, "README.md"), "utf8");
  return dirs(REPO).map((name) => {
    const weight = readme.match(new RegExp(`${name} \\((\\d+)%\\)`));
    return {
      name,
      weight: weight ? Number(weight[1]) : null,
      topics: dirs(path.join(REPO, name)).map((topic) => ({
        domain: name,
        topic,
        id: `${name}/${topic}`,
        written: fs.existsSync(path.join(REPO, name, topic, "README.md")),
      })),
    };
  });
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

/** Repo-relative paths of every reference page, without the index. */
export function listReferences(): string[] {
  return fs
    .readdirSync(path.join(REPO, "references"))
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .sort()
    .map((f) => `references/${f}`);
}
