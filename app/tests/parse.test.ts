import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { learnTitle, listDomains, listLabs, readMarkdown, REPO, topicReadme } from "../app/content/repo";
import { parseLabState } from "../app/lab/state.server";
import { pageLinks, parseExercise, renderDoc, summarize, untitled } from "../app/content/parse";

const KUBEADM = "01-cluster-architecture/00-kubeadm-install/README.md";
const RBAC = "01-cluster-architecture/01-rbac/README.md";
const HELM = "01-cluster-architecture/02-helm/README.md";

describe("repo", () => {
  it("names every domain and topic from the README table", () => {
    const domains = listDomains();
    expect(domains.map((d) => d.name)).toEqual([
      "Core Concepts",
      "kubectl Essentials",
      "Cluster Architecture",
      "Workloads and Scheduling",
      "Services and Networking",
      "Storage",
      "Troubleshooting",
      "Mock Exams",
    ]);
    expect(domains[0].topics.map((t) => [t.name, t.id])).toEqual([["Kubernetes Objects", "00-core-concepts/00-objects"]]);
    expect(domains[1].topics.map((t) => [t.name, t.id])).toEqual([["Working with kubectl", "00-exam-skills/00-exam-workflow"]]);
    const arch = domains[2];
    expect(arch.weight).toBe(25);
    expect(arch.topics.filter((t) => t.written).map((t) => t.name)).toEqual(["kubeadm Installation", "RBAC", "Helm", "Kustomize", "CRDs and Operators"]);
    expect(domains.at(-1)!.topics).toEqual([]);
  });

  it("titles each written topic with its name from the README table", () => {
    for (const t of listDomains().flatMap((d) => d.topics).filter((t) => t.written))
      expect(summarize(readMarkdown(`${t.id}/README.md`)!).title).toBe(t.name);
  });

  it("has a README row for every topic folder", () => {
    const listed = listDomains().flatMap((d) => d.topics.map((t) => t.id));
    const folders = fs
      .readdirSync(REPO)
      .filter((d) => /^\d\d-/.test(d) && d !== "99-mock-exams")
      .flatMap((d) => fs.readdirSync(path.join(REPO, d)).filter((t) => /^\d\d-/.test(t)).map((t) => `${d}/${t}`));
    expect(listed.sort()).toEqual(folders.sort());
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
    expect(ex.title).toBe("kubeadm Installation");
    const recall = ex.sections.find((s) => s.kind === "recall");
    expect(recall?.kind === "recall" && recall.items).toHaveLength(5);
    const practice = ex.sections.find((s) => s.kind === "practice");
    if (practice?.kind !== "practice") throw new Error("no practice");
    expect(practice.minutes).toBe(25);
    expect(practice.tasks).toHaveLength(6);
    expect(practice.tasks.reduce((a, t) => a + t.weight, 0)).toBe(100);
    expect(practice.tasks[3].hosts).toEqual(["controlplane", "node01", "node02"]);
    expect(practice.tasks.every((t) => t.hintHtml && !t.html.includes("Hint"))).toBe(true);
    expect(practice.tasks[2].hintHtml).toContain("Flannel");
    expect(practice.solutionHtml).toContain("Calico</a> defaults");
    expect(practice.solutionHtml).not.toContain("Hint");
    const check = ex.sections.find((s) => s.slug === "check-your-work");
    expect(check?.kind).toBe("plain");
  });

  it("reads rbac's steps and practice", async () => {
    const md = readMarkdown(RBAC)!;
    const s = summarize(md);
    expect(s.stepKeys.length).toBeGreaterThan(10);
    expect(s.stepKeys).toContain("create-two-namespaces#1");
    expect(s.recallKeys).toHaveLength(7);
    expect(s.hasPractice).toBe(true);
    const ex = await parseExercise(md, RBAC);
    const steps = ex.sections.flatMap((x) => (x.kind === "steps" ? x.blocks.flatMap((b) => ("steps" in b ? b.steps : [])) : []));
    expect(steps.map((x) => x.key)).toEqual(s.stepKeys);
    const practice = ex.sections.find((x) => x.kind === "practice");
    if (practice?.kind !== "practice") throw new Error("no practice");
    expect(practice.minutes).toBe(15);
    expect(practice.introHtml).not.toContain("minutes");
    expect(practice.tasks).toHaveLength(5);
    expect(practice.tasks.reduce((a, t) => a + t.weight, 0)).toBe(100);
  });

  it("rewrites links into app routes", async () => {
    const ex = await parseExercise(readMarkdown(RBAC)!, RBAC);
    const html = JSON.stringify(ex);
    expect(html).toContain('href=\\"/doc/references/rbac.md\\"');
    expect(html).toContain('href=\\"/t/01-cluster-architecture/01-rbac/access-control\\"');
    expect(html).toContain('target=\\"_blank\\"');
  });

  it("leaves mermaid for the browser", async () => {
    const file = "learn/cluster-architecture.md";
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

describe("lab", () => {
  it("reads each exercise's lab and keeps lab sections out", async () => {
    for (const [file, lab] of [[KUBEADM, "vms"], [RBAC, "cluster"], [HELM, "helm"]] as const) {
      const ex = await parseExercise(readMarkdown(file)!, file);
      expect(ex.lab).toBe(lab);
      expect(summarize(readMarkdown(file)!).lab).toBe(lab);
      expect(ex.sections.map((x) => x.title)).not.toEqual(expect.arrayContaining(["Prerequisites", "Lab setup", "Clean up"]));
    }
  });

  it("names a lab folder in every written exercise", () => {
    const names = listLabs();
    for (const t of listDomains().flatMap((d) => d.topics).filter((t) => t.written)) {
      const lab = summarize(readMarkdown(`${t.id}/README.md`)!).lab;
      if (lab) expect(names).toContain(lab);
    }
  });

  it("names an existing lab in each base file", () => {
    const names = listLabs();
    for (const l of names) {
      const base = path.join(REPO, "lab/labs", l, "base");
      if (fs.existsSync(base)) expect(names).toContain(fs.readFileSync(base, "utf8").trim());
    }
  });
});

describe("lab state", () => {
  const idle = { starting: null, failed: null };
  const up = "/controlplane cka-controlplane:helm true 2026-10-05T20:00:00Z\n/base cka-base true 2026-10-05T20:00:00Z\n";

  it("reads the running lab from the controlplane image", () => {
    expect(parseLabState("clean\ncluster\nhelm\n", up, idle)).toEqual({
      status: "running",
      lab: "helm",
      startedAt: "2026-10-05T20:00:00Z",
      saved: ["cluster", "helm"],
    });
  });

  it("tells stopped, starting, failed and never-started apart", () => {
    const down = up.replace(/true/g, "false");
    expect(parseLabState("cluster\n", down, idle).status).toBe("stopped");
    expect(parseLabState("clean\n", "", idle)).toMatchObject({ status: "none", saved: [] });
    expect(parseLabState("cluster\n", up, { starting: "kustomize", failed: null })).toMatchObject({ status: "starting", lab: "kustomize" });
    expect(parseLabState("cluster\n", up, { starting: null, failed: "crds" })).toMatchObject({ status: "failed", lab: "crds" });
  });
});

describe("lessons", () => {
  it("splits a topic into Introduction, its Learn pages, one lesson per section, Quiz and Practice", () => {
    const s = summarize(readMarkdown(HELM)!, learnTitle);
    expect(s.lessons.map((l) => l.title)).toEqual([
      "Introduction",
      "How Helm works",
      "Find a chart",
      "Read the values",
      "Install a release",
      "Upgrade a release",
      "Roll back",
      "Render without installing",
      "Uninstall",
      "Quiz",
      "Practice",
    ]);
    expect(s.lessons[0].sections).toEqual(["objectives"]);
    expect(s.lessons.at(-1)!.sections).toEqual(["practice", "check-your-work", "further-reading"]);
    expect(s.lessons.flatMap((l) => l.stepKeys)).toEqual(s.stepKeys);
    expect(pageLinks("[pods](../../references/pod.md)", "learn")).toEqual([]);
  });

  it("keeps a section without numbered steps as a lesson of its own once lessons have started", () => {
    const titles = summarize(readMarkdown(KUBEADM)!, learnTitle).lessons.map((l) => l.title);
    expect(titles).toContain("Point kubectl at the cluster");
    expect(titles).toContain("Check the control plane");
    expect(titles).not.toContain("Objectives");
  });

  it("opens a reference from a Learn page as a page of its own", async () => {
    const file = "learn/helm.md";
    const html = (await renderDoc(readMarkdown(file)!, file, { id: "01-cluster-architecture/02-helm", learn: ["helm"] })).html;
    expect(html).toContain('href="/doc/references/helm.md');
  });
});

