import { describe, expect, it } from "vitest";
import { learnTitle, listDomains, listLabs, readMarkdown, topicReadme } from "../app/content/repo";
import { parseLabState } from "../app/lab/state.server";
import { mdSection, pageLinks, parseExercise, renderDoc, summarize, untitled } from "../app/content/parse";

const KUBEADM = "01-cluster-architecture/00-kubeadm-install/README.md";
const RBAC = "01-cluster-architecture/01-rbac/README.md";
const HELM = "01-cluster-architecture/02-helm/README.md";

describe("repo", () => {
  it("lists every domain and topic folder", () => {
    const domains = listDomains();
    expect(domains.map((d) => d.name)).toContain("99-mock-exams");
    expect(domains[0].name).toBe("00-exam-skills");
    expect(domains[0].topics.filter((t) => t.written).map((t) => t.topic)).toEqual(["00-exam-workflow"]);
    const arch = domains.find((d) => d.name === "01-cluster-architecture")!;
    expect(arch.weight).toBe(25);
    expect(arch.topics).toHaveLength(9);
    expect(arch.topics.filter((t) => t.written).map((t) => t.topic)).toEqual(["00-kubeadm-install", "01-rbac", "02-helm", "03-kustomize", "04-crds-operators"]);
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
    expect(practice.solutionHtml).toContain("Calico</a> defaults");
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
    expect(practice.tasks).toHaveLength(5);
    expect(practice.tasks.reduce((a, t) => a + t.weight, 0)).toBe(100);
  });

  it("rewrites links into app routes", async () => {
    const ex = await parseExercise(readMarkdown(RBAC)!, RBAC);
    const html = JSON.stringify(ex);
    expect(html).toContain('href=\\"#lab\\"');
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
      expect(ex.labHtml).toContain('href="#lab"');
      expect(ex.introHtml).not.toContain("Starts from");
      expect(ex.sections.map((x) => x.title)).not.toEqual(expect.arrayContaining(["Prerequisites", "Lab setup", "Clean up"]));
    }
  });

  it("names a lab folder in every written exercise", () => {
    const names = listLabs().map((l) => l.name);
    for (const t of listDomains().flatMap((d) => d.topics).filter((t) => t.written)) {
      const lab = summarize(readMarkdown(`${t.id}/README.md`)!).lab;
      if (lab) expect(names).toContain(lab);
    }
  });

  it("lists each lab after the lab it builds on", () => {
    const labs = listLabs();
    expect(labs.map((l) => [l.name, l.from])).toEqual([
      ["vms", null],
      ["cluster", "vms"],
      ["crds", "cluster"],
      ["helm", "cluster"],
      ["kustomize", "cluster"],
    ]);
  });

  it("links other labs to the Labs page, even on a topic page", async () => {
    const helm = listLabs().find((l) => l.name === "helm")!;
    const doc = await renderDoc(untitled(helm.md), "lab/labs/helm/README.md", { id: "01-cluster-architecture/02-helm", learn: ["helm"] });
    expect(doc.html).toContain('href="/labs#cluster"');
    expect(doc.html).not.toContain("<h1");
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

describe("bundle", () => {
  it("pulls the Machines section out of the Labs page", () => {
    const machines = mdSection(readMarkdown("lab/labs/README.md")!, "Machines");
    expect(machines).toContain("controlplane");
    expect(mdSection(readMarkdown("lab/README.md")!, "Machines")).toBe("");
    expect(mdSection(readMarkdown("lab/README.md")!, "nope")).toBe("");
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
    expect(s.lessons.at(-1)!.sections).toEqual(["practice", "check-your-work", "next"]);
    expect(s.lessons.flatMap((l) => l.stepKeys)).toEqual(s.stepKeys);
    expect(pageLinks("[pods](../../references/pod.md)", "learn")).toEqual([]);
  });

  it("opens a reference from a Learn page as a page of its own", async () => {
    const file = "learn/helm.md";
    const html = (await renderDoc(readMarkdown(file)!, file, { id: "01-cluster-architecture/02-helm", learn: ["helm"] })).html;
    expect(html).toContain('href="/doc/references/helm.md');
  });
});

