# CKA practice labs

The reader is studying for the CKA. [README.md](README.md) is the entry point. Its table names every domain and topic the way the app shows them, and a topic's `# title` matches its row. [lab/README.md](lab/README.md) is the Getting started page: setup, using the app, grading and troubleshooting. `lab/labs/` holds one folder per lab an exercise starts from. [EXAM.md](EXAM.md) is the About the CKA page: the format, the domains and their competencies. `app/` is the study app that shows each topic as lessons in the sidebar: Introduction, one lesson per steps section with each Learn page just before the lesson that first links it, Quiz and Practice, with the lab beside each lesson. Learn pages in `learn/` explain how a technology works and why. Reference pages in `references/` hold the facts, commands and errors to look up.

## Skills

- Writing or extending an exercise, a lab, or a page in `learn/` or `references/` → use the `build-exercise` skill.

## Lab details live in one place

Everything about running the lab lives in `lab/README.md` and `lab/labs/` and nowhere else. Each lab is a folder, `lab/labs/<name>/`, with a `base` file naming the lab it builds on, if any, and a `setup.sh`; `lab/lab.sh` and the app read those folders, so adding a lab touches nothing else. The app never describes a lab: no lab page, no lab names, no lab status outside the topic. A topic's Introduction names where the learner logs in (`base`), the machines they can reach and what the lab already has set up; nothing else lists machines. A topic shows Start lab, then the terminal with New session and Reset. An exercise names its lab only in an invisible `<!-- lab: <name> -->` comment, puts any fact a task needs in the task, and never mentions `docker`, saved copies, the computer it runs on or the lab's IP addresses.

## Wording

Write the app's text and the pages it shows the way a course site such as KodeKloud does. Full sentences are fine. These six habits are not:

- Text that describes the app itself, what it stores, or how its screens behave. Show the thing instead.
- Terms invented while building. Use the words a learner already knows: lab, quiz, practice exam, score. Never "starting state", "Recall", "timed run" or "ticks".
- Text from the author's side, such as "not written", "this exercise names no lab" or "The lab installed one release for the Practice section to find". Say what the learner sees: "Coming soon", "This topic has no lab.", "One release is already installed."
- Headings that are phrases instead of names. Use "Dashboard", "Lab", "Practice", "Solution", not "Where you are" or "Practice it".
- Coaching the learner or explaining edge cases they didn't ask about, such as "Answer each one in your head before you open it."
- Framing lessons around the exam, such as "the way the exam asks" or "every exam host". Name the CKA only for a fact about it, and keep "practice exam".

## App

Run `cd app && pnpm test` after changing the app or the README format it reads.
