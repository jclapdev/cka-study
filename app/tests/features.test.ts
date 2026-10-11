import fs from "node:fs";
import path from "node:path";
import { getTableName, isTable } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as schema from "../app/db/schema";

// FEATURES.md is the list a sweep of the app walks, so everything the app has must be on it.
const APP = path.join(__dirname, "..");
const features = fs.readFileSync(path.join(APP, "FEATURES.md"), "utf8");
const read = (rel: string) => fs.readFileSync(path.join(APP, rel), "utf8");
const named = (name: string) => features.includes(`\`${name}\``);
const sources = (dir: string): string[] =>
  fs.readdirSync(path.join(APP, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    return e.isDirectory() ? sources(rel) : /\.tsx?$/.test(e.name) ? [rel] : [];
  });
const code = sources("app").map(read).join("\n") + read("terminal.ts");

describe("FEATURES.md names everything the app has", () => {
  it("every route", () => {
    const files = [...read("app/routes.ts").matchAll(/"(routes\/[\w.]+)"/g)].map((m) => m[1]);
    expect(files.length).toBeGreaterThan(5);
    expect(files.filter((f) => !named(f))).toEqual([]);
  });

  it("every component", () => {
    const files = fs.readdirSync(path.join(APP, "app/components")).map((f) => `components/${f}`);
    expect(files.filter((f) => !named(f))).toEqual([]);
  });

  it("every table", () => {
    const tables = Object.values(schema).filter(isTable).map(getTableName);
    expect(tables.filter((t) => !named(t))).toEqual([]);
  });

  it("every cookie", () => {
    const prefs = read("app/prefs.ts");
    const splits = [...(prefs.match(/type SplitName = (.+);/)![1].matchAll(/"(\w+)"/g))].map((m) => `split-${m[1]}`);
    const plain = [...prefs.match(/setPref\(name: (.+?), value/)![1].matchAll(/"([\w-]+)"/g)].map((m) => m[1]);
    const cookies = [...plain, ...splits].map((n) => `cka-${n}`);
    expect(cookies.length).toBeGreaterThan(3);
    expect(cookies.filter((c) => !named(c))).toEqual([]);
  });

  it("every name the app gives a stored value, window or channel, and no localStorage", () => {
    const names = [...new Set([...code.matchAll(/"(cka-[a-z-]+)"/g)].map((m) => m[1]))];
    expect(names.filter((n) => !named(n))).toEqual([]);
    expect(code).not.toContain("localStorage");
  });

  it("every file the lab controller keeps", () => {
    const files = [...read("app/lab/controller.ts").matchAll(/path\.join\(this\.dir, "([\w.]+)"\)/g)].map((m) => m[1]);
    expect(files.length).toBeGreaterThan(1);
    expect(files.filter((f) => !named(f))).toEqual([]);
  });

  it("every socket", () => {
    const sockets = [...read("terminal.ts").matchAll(/pathname !== "(\/\w+)"/g)].map((m) => m[1]);
    expect(sockets.length).toBeGreaterThan(1);
    expect(sockets.filter((s) => !named(s))).toEqual([]);
  });

  it("every situation has a browser test, unless it says why not", () => {
    const list = features.split("## Situations")[1].split("\n## ")[0];
    const situations = [...list.matchAll(/^- \*\*(.+?)\*\*( \(no browser test\))?/gm)].filter((m) => !m[2]).map((m) => m[1]);
    const tests = [...read("tests/browser/app.situations.ts").matchAll(/^test\("([^"]+)"/gm)].map((m) => m[1]);
    expect(situations.length).toBeGreaterThan(10);
    expect(situations.filter((s) => !tests.some((t) => t.startsWith(s)))).toEqual([]);
  });
});
