import { describe, expect, it } from "vitest";
import { listDomains, readMarkdown, topicReadme } from "../app/content/repo";
import { parseExercise, summarize } from "../app/content/parse";

const KUBEADM = "01-cluster-architecture/00-kubeadm-install/README.md";
const RBAC = "01-cluster-architecture/01-rbac/README.md";

describe("repo", () => {
  it("lists every domain and topic folder", () => {
    const domains = listDomains();
    expect(domains.map((d) => d.name)).toContain("99-mock-exams");
    const arch = domains.find((d) => d.name === "01-cluster-architecture")!;
    expect(arch.weight).toBe(25);
    expect(arch.topics).toHaveLength(9);
    expect(arch.topics.filter((t) => t.written).map((t) => t.topic)).toEqual(["00-kubeadm-install", "01-rbac"]);
  });

  it("refuses paths outside the repo, non-Markdown and the app", () => {
    expect(readMarkdown("../../../etc/passwd")).toBeNull();
    expect(readMarkdown("lab/provision.sh")).toBeNull();
    expect(readMarkdown("app/node_modules/vite/README.md")).toBeNull();
    expect(readMarkdown("references/rbac.md")).not.toBeNull();
    expect(topicReadme("..", "etc")).toBeNull();
  });
});

describe("parse", () => {
  it("reads kubeadm-install's recall and practice", async () => {
    const ex = await parseExercise(readMarkdown(KUBEADM)!, KUBEADM);
    expect(ex.title).toBe("Bootstrapping a Cluster with kubeadm");
    const recall = ex.sections.find((s) => s.kind === "recall");
    expect(recall?.kind === "recall" && recall.items).toHaveLength(5);
    const practice = ex.sections.find((s) => s.kind === "practice");
    if (practice?.kind !== "practice") throw new Error("no practice");
    expect(practice.minutes).toBe(25);
    expect(practice.tasks).toHaveLength(6);
    expect(practice.tasks.reduce((a, t) => a + t.weight, 0)).toBe(100);
    expect(practice.tasks[3].hosts).toEqual(["controlplane", "node01", "node02"]);
    expect(practice.solutionHtml).toContain("Calico defaults");
    const check = ex.sections.find((s) => s.slug === "check-your-work");
    expect(check?.kind).toBe("plain");
  });

  it("gives rbac steps and no practice", async () => {
    const md = readMarkdown(RBAC)!;
    const s = summarize(md);
    expect(s.stepKeys.length).toBeGreaterThan(10);
    expect(s.stepKeys).toContain("lab-setup#2");
    expect(s.recallKeys).toHaveLength(7);
    expect(s.hasPractice).toBe(false);
    const ex = await parseExercise(md, RBAC);
    const steps = ex.sections.flatMap((x) => (x.kind === "steps" ? x.blocks.flatMap((b) => ("steps" in b ? b.steps : [])) : []));
    expect(steps.map((x) => x.key)).toEqual(s.stepKeys);
  });

  it("rewrites links into app routes", async () => {
    const ex = await parseExercise(readMarkdown(RBAC)!, RBAC);
    const html = JSON.stringify(ex);
    expect(html).toContain('href=\\"/t/01-cluster-architecture/00-kubeadm-install\\"');
    expect(html).toContain('href=\\"/doc/references/rbac.md\\"');
    expect(html).toContain('target=\\"_blank\\"');
  });

  it("leaves mermaid for the browser", async () => {
    const file = "references/control-plane.md";
    const ex = await parseExercise(readMarkdown(file)!, file);
    expect(JSON.stringify(ex)).toContain('<pre class=\\"mermaid\\">');
  });
});

describe("steps", () => {
  it("counts a teaching section whose heading starts with Check", () => {
    const s = summarize(readMarkdown(KUBEADM)!);
    expect(s.stepKeys).toContain("check-what-is-already-running#1");
  });
});
