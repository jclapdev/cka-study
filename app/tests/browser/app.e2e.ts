import { expect, type Page, test } from "@playwright/test";

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

/** Every available topic's lessons, read from the sidebar. */
async function topics(page: Page) {
  await page.goto("/");
  const ids = await page.locator('#topics a[href^="/t/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
  const out: { id: string; lessons: string[] }[] = [];
  for (const id of ids) {
    await page.goto(id);
    out.push({ id, lessons: await page.locator('ul[aria-label="Lessons"] a').evaluateAll((as) => as.map((a) => a.getAttribute("href")!)) });
  }
  return out;
}

/** Scrolls the lesson to its end, in its own pane beside the lab or in the window. */
const toBottom = (page: Page) =>
  page.evaluate(() => {
    const pane = document.getElementById("lesson");
    if (pane) pane.scrollTop = pane.scrollHeight;
    else window.scrollTo(0, document.body.scrollHeight);
  });

/** Where the lesson title sits, in pixels from the top of the screen. */
const titleTop = (page: Page) => page.locator("main h1, #lesson h1").first().evaluate((h) => h.getBoundingClientRect().top);

async function opensAtTop(page: Page, click: () => Promise<void>, href: string) {
  await toBottom(page);
  await click();
  await page.waitForURL((u) => u.pathname === href);
  await expect.poll(() => titleTop(page), { message: `${href} opens at its title` }).toBeGreaterThanOrEqual(0);
  expect(await titleTop(page), `${href} opens at its title`).toBeLessThan(250);
}

for (const [name, size] of Object.entries({ desktop: DESKTOP, phone: PHONE })) {
  test.describe(name, () => {
    test.use({ viewport: size });

    test("Next, Previous and the lesson list open each lesson at its title", async ({ page }) => {
      for (const { lessons } of await topics(page)) {
        await page.goto(lessons[0]);
        for (const href of lessons.slice(1))
          await opensAtTop(page, () => page.getByRole("navigation", { name: "Lessons" }).getByRole("link", { name: /Next/ }).click(), href);
        await opensAtTop(page, () => page.getByRole("navigation", { name: "Lessons" }).getByRole("link", { name: /Previous/ }).click(), lessons.at(-2)!);
        if (size === DESKTOP)
          await opensAtTop(page, () => page.locator(`ul[aria-label="Lessons"] a[href="${lessons[1]}"]`).click(), lessons[1]);
      }
    });

    test("every lesson reads cleanly", async ({ page }) => {
      for (const { lessons } of await topics(page))
        for (const href of lessons) {
          await page.goto(href);
          // A backtick outside code is Markdown that was shown as text.
          const raw = await page.evaluate(() => {
            const walk = document.createTreeWalker(document.querySelector("article")!, NodeFilter.SHOW_TEXT);
            const found: string[] = [];
            for (let n = walk.nextNode(); n; n = walk.nextNode())
              if (n.textContent!.includes("`") && !n.parentElement!.closest("code, pre, textarea")) found.push(n.textContent!.trim());
            return found;
          });
          expect(raw, `${href} shows no raw Markdown`).toEqual([]);
          const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          expect(sideways, `${href} does not scroll sideways`).toBeLessThanOrEqual(0);
          if (size === PHONE) {
            // Present is not enough: the lesson beside the lab once covered it.
            const onTop = await page.getByRole("button", { name: "Topics" }).evaluate((b) => {
              const r = b.getBoundingClientRect();
              return b.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
            });
            expect(onTop, `${href} keeps the topic list in reach`).toBe(true);
          }
        }
    });

    test("screenshots of each kind of page", async ({ page }, info) => {
      const [first] = await topics(page);
      const pages = {
        dashboard: "/",
        introduction: first.lessons[0],
        lesson: first.lessons[3],
        quiz: first.lessons.at(-2)!,
        practice: first.lessons.at(-1)!,
        "getting-started": "/doc/lab/README.md",
        references: "/doc/references/README.md",
      };
      for (const [shot, href] of Object.entries(pages)) {
        await page.goto(href);
        await page.screenshot({ path: info.outputPath(`${name}-${shot}.png`) });
      }
    });
  });
}

test("a done step folds to its first line and opens again", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  const [first] = await topics(page);
  // A step not yet done, with a code block under its first line. The test unticks it again at the end.
  const steps = page.locator("article li:has(> form button[aria-pressed])");
  let i = -1;
  for (const href of first.lessons) {
    await page.goto(href);
    i = await steps.evaluateAll((lis) =>
      lis.findIndex((li) => li.querySelector('button[aria-pressed="false"]') && li.querySelector("pre")),
    );
    if (i >= 0) break;
  }
  expect(i, "a lesson has a step to tick").toBeGreaterThanOrEqual(0);
  const step = steps.nth(i);
  const tick = step.locator("button[aria-pressed]");
  const code = step.locator("pre").first();
  const toggle = step.locator("button[aria-expanded]");

  await tick.click();
  await expect(code).toBeHidden();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await page.reload();
  await expect(code).toBeHidden();

  await toggle.click();
  await expect(code).toBeVisible();
  await toggle.click();
  await expect(code).toBeHidden();
  await step.locator(".md > :first-child").click({ position: { x: 5, y: 5 } });
  await expect(code).toBeVisible();

  await tick.click();
  await expect(tick).toHaveAttribute("aria-pressed", "false");
  await expect(code).toBeVisible();
  await expect(toggle).toHaveCount(0);
});
