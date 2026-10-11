# CKA practice labs

The reader is studying for the CKA. [README.md](README.md) is the entry point. Its table names every domain and topic the way the app shows them, and a topic's `# title` matches its row. [lab/README.md](lab/README.md) is the Getting started page: setup, using the app, grading and troubleshooting. `lab/labs/` holds one folder per lab an exercise starts from. [EXAM.md](EXAM.md) is the About the CKA page: the format, the domains and their competencies. `app/` is the study app that shows each topic as lessons in the sidebar: Introduction, one lesson per steps section with each Learn page just before the lesson that first links it, Quiz and Practice, with the lab beside each lesson. Learn pages in `learn/` explain how a technology works and why. Reference pages in `references/` hold the facts, commands and errors to look up.

## Skills

- Writing or extending an exercise, a lab, or a page in `learn/` or `references/` → use the `build-exercise` skill.

## Lab details live in one place

Everything about running the lab lives in `lab/README.md` and `lab/labs/` and nowhere else. Each lab is a folder, `lab/labs/<name>/`, with a `base` file naming the lab it builds on, if any, and a `setup.sh`; `lab/lab.sh` and the app read those folders, so adding a lab touches nothing else. The app never describes a lab: no lab page, no lab names, no lab status outside the topic. A topic's Introduction names where the learner logs in (`base`), the machines they can reach and what the lab already has set up; nothing else lists machines. A topic shows Start lab, then terminal tabs with + and Reset lab. An exercise names its lab only in an invisible `<!-- lab: <name> -->` comment, puts any fact a task needs in the task, and never mentions `docker`, saved copies, the computer it runs on or the lab's IP addresses.

## Wording

Write the app's text and the pages it shows the way a course site such as KodeKloud does. Full sentences are fine. Before writing any text a learner sees, in a page or in `app/app`, read the style list, [.claude/skills/build-exercise/references/style.md](.claude/skills/build-exercise/references/style.md): every habit that has made a page read oddly, with a line that failed and its rewrite.

When the user flags a line that reads oddly, one example is enough: add an entry to the style list, add a Vale rule in `.vale/styles/CKA/` if a pattern catches it without catching good lines, and fix every page that has it, in the same change. `cd app && pnpm overused` lists the phrases the pages use far more often than the Kubernetes docs do, which finds habits nobody has named yet.

## App

Run `cd app && pnpm test` after changing the app, the README format it reads, or any page: it ends with Vale's style checks on every page. Then run `pnpm test:browser` and `pnpm test:situations`, which each start a copy of the app of their own with a stand-in lab, and look at the screenshots both save in `app/test-results/`. `CKA_URL=http://localhost:5173 pnpm test:browser` checks the Docker app itself, but writes the tests' visits and check-offs into the learner's progress.

[app/FEATURES.md](app/FEATURES.md) lists every part of the app and what it does in each situation (fresh open, reload, second window, switching topics, Reset lab, practice exam, pop-out, Docker stopped, idle, phone, dark mode). A sweep of the app walks every row through every situation in a real browser and fixes what it finds in the same change; `pnpm test` fails when the app has something the list doesn't name. Each change a learner can see gets a dated line in [CHANGELOG.md](CHANGELOG.md), shown as What's new.

## Readers

Before pushing a changed topic README, Learn page, reference page, `EXAM.md`, `CHANGELOG.md`, `lab/README.md` or `README.md`, run the `cold-reader` agent (can a newcomer follow it) and the `style-reader` agent (does it follow the style list) on those pages, fix what they find, and run them again until each page is clear. Run the `style-reader` on changed `app/app` files too. Git refuses the push otherwise, and also when Vale fails (`.githooks/pre-push`, enabled once per checkout with `git config core.hooksPath .githooks`).
