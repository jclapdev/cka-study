import { describe, expect, it } from "vitest";
import { listDomains, readMarkdown } from "../app/content/repo";
import { summarize } from "../app/content/parse";

// The parts of "makes sense to a newcomer" that a script can check. The rest is the cold-reader's.
const topics = listDomains()
  .flatMap((d) => d.topics)
  .filter((t) => t.written)
  .map((t) => ({ id: t.id, md: readMarkdown(`${t.id}/README.md`)! }))
  .map((t) => ({ ...t, summary: summarize(t.md) }));

/** The markdown of a `##` section, from below its heading to the next `##`. */
const sectionText = (md: string, title: string) => md.split(`\n## ${title}\n`)[1]?.split(/\n## /)[0] ?? "";

describe("a newcomer can follow each topic", () => {
  for (const { id, md, summary } of topics.filter((t) => t.summary.lab)) {
    const lessons = summary.lessons.filter((l) => l.kind === "steps" && l.stepKeys.length);

    it(`${id}: the Introduction says what the lab is and to ssh to controlplane first`, () => {
      const intro = md.split("\n## ")[0];
      const lab = intro.split(/<!-- lab: [\w-]+ -->/)[1] ?? "";
      expect(lab).toMatch(/^\s*The lab beside each lesson/);
      expect(lab).toContain("ssh controlplane");
    });

    it(`${id}: the first lesson starts with ssh controlplane`, () => {
      const block = sectionText(md, lessons[0].title).match(/```shell\n([\s\S]*?)```/)?.[1] ?? "";
      expect(block.trim().split("\n")[0].trim()).toBe("ssh controlplane");
    });

    it(`${id}: every lesson opens with what it does before step 1`, () => {
      for (const l of lessons) {
        const before = sectionText(md, l.title).split(/^1\. /m)[0];
        expect(before.trim(), `"${l.title}" starts straight at step 1`).not.toBe("");
      }
    });
  }
});
