import fs from "node:fs";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";

// Each situation from FEATURES.md, walked the way a learner would. The lab is a stand-in
// (fake/lab.sh): a start takes a second and machines.json says what the machines run.
const DIR = process.env.CKA_SITUATIONS!;
const machines = (m: object) => fs.writeFileSync(path.join(DIR, "machines.json"), JSON.stringify(m));
const OBJECTS = "/t/00-core-concepts/00-objects";
const RBAC = "/t/01-cluster-architecture/01-rbac";
const HELM = "/t/01-cluster-architecture/02-helm";

const panel = (page: Page) => page.getByRole("tablist", { name: "Panel" });
const terminalTabs = (page: Page) => panel(page).getByRole("tab", { name: /^Terminal \d$/ });

/** Starts a topic's lab from its Start lab button, answering the question if one comes. */
async function startLab(page: Page, topic: string) {
  await page.goto(topic);
  await page.getByRole("button", { name: "Start lab" }).click();
  const dialog = page.locator("dialog[open]");
  if (await dialog.isVisible().catch(() => false)) await dialog.getByRole("button", { name: "Start lab" }).click();
  await expect(terminalTabs(page).first()).toBeVisible({ timeout: 15_000 });
}

/** Types into the terminal showing and waits for `expected` on its screen. */
async function run(page: Page, command: string, expected: string) {
  const screen = page.locator(".xterm:visible").first();
  await screen.click();
  await page.keyboard.type(`${command}\n`);
  await expect(screen.locator(".xterm-rows")).toContainText(expected, { timeout: 10_000 });
}

test.beforeEach(() => machines({ lab: null, up: false }));

test("fresh open: Continue returns to the lesson opened last, and its terminal is the one left", async ({ page, context }) => {
  await startLab(page, OBJECTS);
  await run(page, "echo left-here", "left-here");
  await page.goto(`${OBJECTS}/write-a-pod-in-yaml`);
  await page.close();
  const again = await context.newPage();
  await again.goto("/");
  const cont = again.getByRole("link", { name: "Continue" });
  await expect(cont).toHaveAttribute("href", `${OBJECTS}/write-a-pod-in-yaml`);
  await cont.click();
  await expect(again.locator("#lesson h1")).toHaveText("Write a pod in YAML");
  await expect(again.locator(".xterm-rows").first()).toContainText("left-here");
});

test("reload: the lesson keeps its place and the terminal its screen", async ({ page }) => {
  await startLab(page, OBJECTS);
  await run(page, "echo before-reload", "before-reload");
  await page.goto(`${OBJECTS}/run-a-pod`);
  await page.locator("#lesson").evaluate((p) => (p.scrollTop = 600));
  await page.waitForTimeout(300);
  await page.reload();
  await expect.poll(() => page.locator("#lesson").evaluate((p) => p.scrollTop)).toBeGreaterThan(500);
  await expect(page.locator(".xterm-rows").first()).toContainText("before-reload");
});

test("same lab, other topic: RBAC starts its own lab, after asking about the one Kubernetes Objects started", async ({ page }) => {
  await startLab(page, OBJECTS);
  await run(page, "echo objects-shell", "objects-shell");
  await page.goto(RBAC);
  await expect(page.getByRole("button", { name: "Start lab" })).toBeVisible();
  await page.getByRole("button", { name: "Start lab" }).click();
  await expect(page.locator("dialog[open]")).toContainText("The lab you started in Kubernetes Objects ends");
  await page.locator("dialog[open]").getByRole("button", { name: "Start lab" }).click();
  await expect(terminalTabs(page)).toHaveCount(1, { timeout: 15_000 });
  await expect(page.locator(".xterm-rows").first()).not.toContainText("objects-shell");
  await page.goto(OBJECTS);
  await expect(page.getByRole("button", { name: "Start lab" })).toBeVisible();
});

test("different lab, other topic: Helm shows Start lab while Kubernetes Objects' lab runs", async ({ page }) => {
  await startLab(page, OBJECTS);
  await page.goto(HELM);
  await expect(page.getByRole("button", { name: "Start lab" })).toBeVisible();
  await expect(terminalTabs(page)).toHaveCount(0);
});

test("second window: Reset lab in one window gives every window one fresh terminal", async ({ page, context }) => {
  await startLab(page, OBJECTS);
  await panel(page).getByRole("button", { name: "New terminal" }).click();
  await expect(terminalTabs(page)).toHaveCount(2);
  const other = await context.newPage();
  await other.goto(OBJECTS);
  await expect(terminalTabs(other)).toHaveCount(2);
  await page.getByRole("button", { name: "Reset lab" }).click();
  await page.locator("dialog[open]").getByRole("button", { name: "Reset lab" }).click();
  await expect(terminalTabs(other)).toHaveCount(1, { timeout: 15_000 });
  await expect(terminalTabs(page)).toHaveCount(1);
  await run(other, "echo after-reset", "after-reset");
});

test("lab not started, then failed: Start lab, then Try again", async ({ page }) => {
  fs.writeFileSync(path.join(DIR, "fail.txt"), "cluster\n");
  try {
    await page.goto(OBJECTS);
    await page.getByRole("button", { name: "Start lab" }).click();
    await expect(page.getByText("The lab didn't start.")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  } finally {
    fs.rmSync(path.join(DIR, "fail.txt"));
  }
});

test("practice exam: the clock starts once the lab runs, and survives a reload and a look at another lesson", async ({ page }) => {
  await page.goto(`${RBAC}/practice`);
  await page.getByRole("button", { name: "Start practice exam" }).click();
  await page.locator("dialog[open]").getByRole("button", { name: "Start" }).click();
  const timer = page.getByRole("timer");
  await expect(timer).toBeVisible({ timeout: 15_000 });
  await page.reload();
  await expect(timer).toBeVisible();
  await page.goto(`${RBAC}/write-a-role`);
  await expect(page.locator("#lesson h1")).toHaveText("Write a Role");
  await expect(page.locator("#lesson section").first()).toBeVisible();
  await page.goto(`${RBAC}/practice`);
  await expect(timer).toBeVisible();
  // Finish and Quit both end the exam, so each asks first, like Start and Reset lab.
  await page.getByRole("button", { name: "Finish" }).click();
  await page.locator("dialog[open]").getByRole("button", { name: "Cancel" }).click();
  await expect(timer).toBeVisible();
  await page.getByRole("button", { name: "Quit" }).click();
  await page.locator("dialog[open]").getByRole("button", { name: "Quit" }).click();
  await expect(page.getByRole("button", { name: "Start practice exam" })).toBeVisible();
});

test("pop-out: the window belongs to its topic and closes when another topic's lab starts", async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await startLab(page, OBJECTS);
  const [popup] = await Promise.all([context.waitForEvent("page"), page.getByRole("button", { name: "Open in new window" }).click()]);
  await expect(terminalTabs(popup).first()).toBeVisible();
  await expect(terminalTabs(page)).toHaveCount(0);
  await page.goto(HELM);
  await page.getByRole("button", { name: "Start lab" }).click();
  await page.locator("dialog[open]").getByRole("button", { name: "Start lab" }).click();
  await popup.waitForEvent("close", { timeout: 15_000 });
  await expect(terminalTabs(page).first()).toBeVisible({ timeout: 15_000 });
});

test("pop-out is not offered at phone width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startLab(page, OBJECTS);
  await expect(page.getByRole("button", { name: "Open in new window" })).toBeHidden();
});

test("Docker stopped: every window says so, and recovers by itself", async ({ page }) => {
  await startLab(page, OBJECTS);
  machines({ docker: false, lab: null, up: false });
  await expect(page.getByText("Docker is not running")).toBeVisible({ timeout: 15_000 });
  machines({ lab: "cluster", up: true });
  await expect(terminalTabs(page).first()).toBeVisible({ timeout: 15_000 });
});

test("idle: a lab with no terminal open stops by itself", async ({ page }) => {
  await startLab(page, OBJECTS);
  await page.goto("/");
  // CKA_LAB_IDLE_MINUTES is 0.1 for these tests: six seconds.
  await expect.poll(() => JSON.parse(fs.readFileSync(path.join(DIR, "machines.json"), "utf8")).up, { timeout: 20_000 }).toBe(false);
  await page.goto(OBJECTS);
  await expect(page.getByRole("button", { name: "Start lab" })).toBeVisible();
});

test("phone width: Start lab sits in a bar under the lesson from the first paint", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(OBJECTS, { waitUntil: "commit" });
  await page.waitForSelector("#lesson");
  const height = await page.evaluate(() => document.getElementById("lesson")!.getBoundingClientRect().height);
  expect(height).toBeGreaterThan(500);
});

test("dark mode: the terminal follows a switch while it is open", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await startLab(page, OBJECTS);
  // The colours are drawn, not styled, so compare pictures of the terminal.
  const shot = async () => (await page.locator(".xterm").first().screenshot({ animations: "disabled", caret: "hide" })).toString("base64");
  const light = await shot();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(shot).not.toBe(light);
});

test("notes: text typed just before leaving is kept", async ({ page }) => {
  await page.goto(OBJECTS);
  await page.locator("summary", { hasText: "Notes" }).click();
  await page.getByLabel("Notes").fill("kept on leaving");
  await page.getByRole("navigation", { name: "Lessons" }).getByRole("link", { name: /Next/ }).click();
  await page.reload();
  await page.locator("summary", { hasText: "Notes" }).click();
  await expect(page.getByLabel("Notes")).toHaveValue("kept on leaving");
});

test("notes: text typed just before the tab closes is kept", async ({ page, context }) => {
  await page.goto(`${OBJECTS}/run-a-pod`);
  await page.locator("summary", { hasText: "Notes" }).click();
  await page.getByLabel("Notes").fill("kept on closing");
  await page.close({ runBeforeUnload: true });
  const again = await context.newPage();
  await again.goto(`${OBJECTS}/run-a-pod`);
  await again.locator("summary", { hasText: "Notes" }).click();
  await expect(again.getByLabel("Notes")).toHaveValue("kept on closing");
});

test("lesson ticks: an opened Introduction is ticked in the sidebar", async ({ page }) => {
  await page.goto(HELM);
  await page.goto(`${HELM}/quiz`);
  await expect(page.locator('ul[aria-label="Lessons"] a', { hasText: "Introduction" }).getByTitle("Done")).toBeVisible();
});

test("screenshots of each lab state", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const shot = (name: string) => page.screenshot({ path: info.outputPath(`${name}.png`) });
  await startLab(page, OBJECTS);
  await run(page, "echo hello", "hello");
  await shot("running");
  await page.goto(RBAC);
  await page.getByRole("button", { name: "Start lab" }).click();
  await shot("start-question");
  await page.keyboard.press("Escape");
  await page.goto(`${RBAC}/practice`);
  await page.getByRole("button", { name: "Start practice exam" }).click();
  await shot("exam-question");
  await page.locator("dialog[open]").getByRole("button", { name: "Start" }).click();
  await shot("exam-waiting");
  await expect(page.getByRole("timer")).toBeVisible({ timeout: 15_000 });
  await shot("exam-running");
  await page.getByRole("button", { name: "Quit" }).click();
  machines({ docker: false, lab: null, up: false });
  await expect(page.getByText("Docker is not running")).toBeVisible({ timeout: 15_000 });
  await shot("docker-stopped");
  machines({ lab: null, up: false });
  await page.emulateMedia({ colorScheme: "dark" });
  await startLab(page, HELM);
  await shot("dark-running");
  await page.setViewportSize({ width: 390, height: 844 });
  await shot("phone-running");
});

test("the Introduction has one address", async ({ page }) => {
  await page.goto(`${HELM}/introduction`);
  await expect(page).toHaveURL(new RegExp(`${HELM}$`));
});

test("a request from another site is refused", async ({ request }) => {
  for (const url of [OBJECTS, "/note/00-core-concepts/00-objects", "/lab/cluster"]) {
    const res = await request.post(url, { form: { intent: "step", key: "x", value: "done", body: "x", topic: "x" }, headers: { origin: "http://evil.example" } });
    expect(res.status(), url).toBeGreaterThanOrEqual(400);
  }
});
