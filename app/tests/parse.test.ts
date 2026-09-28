import { describe, expect, it } from "vitest";
import { listDomains, listReferences, readMarkdown, topicReadme } from "../app/content/repo";
import { labSection, parseExercise, referenceCovers, referenceLinks, renderDoc, summarize } from "../app/content/parse";

const KUBEADM = "01-cluster-architecture/00-kubeadm-install/README.md";
const RBAC = "01-cluster-architecture/01-rbac/README.md";

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
    expect(practice.solutionHtml).toContain("Calico defaults");
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
    expect(html).toContain('href=\\"?tab=lab\\"');
    expect(html).toContain('href=\\"?tab=references&#x26;ref=rbac\\"');
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

describe("lab", () => {
  it("reads each exercise's lab and keeps lab sections out", async () => {
    for (const [file, lab] of [[KUBEADM, "vms"], [RBAC, "cluster"]] as const) {
      const ex = await parseExercise(readMarkdown(file)!, file);
      expect(ex.lab).toBe(lab);
      expect(ex.labHtml).toContain('href="?tab=lab"');
      expect(ex.introHtml).not.toContain("Starts from");
      expect(ex.sections.map((x) => x.title)).not.toEqual(expect.arrayContaining(["Prerequisites", "Lab setup", "Clean up"]));
    }
  });

  it("gives the lab page an anchor for each starting state", async () => {
    const doc = await renderDoc(readMarkdown("lab/README.md")!, "lab/README.md");
    expect(doc.html).toContain('id="vms"');
    expect(doc.html).toContain('id="cluster"');
  });
});

describe("bundle", () => {
  it("pulls each exercise's lab section out of the lab guide", () => {
    const guide = readMarkdown("lab/README.md")!;
    expect(labSection(guide, "vms")).toContain("lab/snapshot.sh restore clean");
    expect(labSection(guide, "vms")).not.toContain("restore built");
    expect(labSection(guide, "cluster")).toContain("lab/snapshot.sh restore built");
    expect(labSection(guide, "nope")).toBe("");
  });

  it("lists the reference pages an exercise links to", () => {
    expect(referenceLinks(readMarkdown(KUBEADM)!)).toEqual([
      "references/workers.md",
      "references/kubeconfig.md",
      "references/kubeadm.md",
      "references/control-plane.md",
      "references/pod-network.md",
      "references/pod.md",
      "references/labels.md",
      "references/daemonsets.md",
      "references/namespaces.md",
    ]);
    expect(referenceLinks(readMarkdown(RBAC)!)).toContain("references/rbac.md");
  });
});

describe("references tab", () => {
  it("lists a reference's sections and keeps links between references in the tab", async () => {
    const file = "references/kubeconfig.md";
    const doc = await renderDoc(readMarkdown(file)!, file, true);
    expect(doc.headings.map((h) => h.text)).toEqual(["Resolution order", "On a kubeadm cluster", "Commands", "Failure modes", "Docs"]);
    expect(doc.html).toContain(`id="${doc.headings[0].id}"`);
    expect(doc.html).toContain('href="?tab=references&#x26;ref=control-plane"');
    expect((await renderDoc(readMarkdown(file)!, file)).html).toContain('href="/doc/references/control-plane.md"');
  });

  it("reads the Covers line for each reference", () => {
    const covers = referenceCovers(readMarkdown("references/README.md")!);
    expect(Object.keys(covers).sort()).toEqual(listReferences().map((f) => f.replace(/^references\/|\.md$/g, "")).sort());
    expect(covers.pod).toBe("pods, phases, reading Pending vs CrashLoopBackOff");
  });
});
