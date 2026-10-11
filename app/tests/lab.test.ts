import { describe, expect, it } from "vitest";
import { parseMachines, view } from "../app/lab/controller";

const OBJECTS = "00-core-concepts/00-objects";
const RBAC = "01-cluster-architecture/01-rbac";
const machines = (lab: string, running = true) =>
  ["controlplane", "node01", "node02"].map((n) => `/${n} cka-${n}:${lab} ${running}`).join("\n") + `\n/base cka-base ${running}\n`;

describe("machines", () => {
  it("reads the lab from controlplane's image, and counts the lab up only when all four machines run", () => {
    expect(parseMachines(machines("cluster"))).toEqual({ lab: "cluster", up: true });
    expect(parseMachines(machines("cluster").replace("/node02 cka-node02:cluster true", "/node02 cka-node02:cluster false"))).toEqual({ lab: "cluster", up: false });
    expect(parseMachines("")).toEqual({ lab: null, up: false });
  });
});

describe("lab view", () => {
  const up = { docker: true, lab: "cluster", up: true };
  const owned = { owner: { topic: OBJECTS, lab: "cluster" }, failed: null };

  it("gives the lab to the topic that started it, not to another topic with the same lab", () => {
    expect(view(up, owned, null)).toEqual({ docker: true, owner: OBJECTS, starting: null, failed: null });
    expect(view(up, owned, null).owner).not.toBe(RBAC);
  });

  it("gives the lab to no topic when the machines run another lab, are stopped, or a start is under way", () => {
    expect(view({ ...up, lab: "vms" }, owned, null).owner).toBeNull();
    expect(view({ ...up, up: false }, owned, null).owner).toBeNull();
    expect(view(up, owned, { topic: RBAC, lab: "cluster" })).toEqual({ docker: true, owner: null, starting: RBAC, failed: null });
  });

  it("names the topic whose start failed until the next start", () => {
    const failed = { owner: null, failed: { topic: RBAC, lab: "cluster" } };
    expect(view(up, failed, null).failed).toBe(RBAC);
    expect(view(up, failed, { topic: OBJECTS, lab: "cluster" }).failed).toBeNull();
  });

  it("says when Docker isn't answering", () => {
    expect(view({ docker: false, lab: null, up: false }, owned, null)).toMatchObject({ docker: false, owner: null });
  });
});
