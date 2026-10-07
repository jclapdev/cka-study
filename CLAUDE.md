# CKA practice labs

The reader is studying for the CKA. [README.md](README.md) is the entry point and lists every topic with its status. [lab/README.md](lab/README.md) is the Getting started page: setup, grading and troubleshooting. [lab/labs/](lab/labs/README.md) holds one folder per lab an exercise starts from, and its README lists the machines. [EXAM.md](EXAM.md) covers the exam. `app/` is the study app that shows each topic as lessons in the sidebar: Introduction, its Learn pages, one lesson per steps section, Quiz and Practice, with the lab beside each lesson. Learn pages in `learn/` explain how a technology works and why. Reference pages in `references/` hold the facts, commands and errors to look up.

## Skills

- Writing or extending an exercise, a lab, or a page in `learn/` or `references/` → use the `build-exercise` skill.

## Lab details live in one place

Everything about the lab lives in `lab/README.md` and `lab/labs/` and nowhere else: the machines and how to reach them, the labs, resetting, and lab-specific problems. Each lab is a folder, `lab/labs/<name>/`, with a `README.md` that names the lab it builds on and an optional `setup.sh`; `lab/lab.sh` and the app read those folders, so adding a lab touches nothing else. How the lab is built never appears in a lab README. An exercise names its lab in its lab line and never mentions `docker`, saved copies, the computer it runs on or the lab's IP addresses.

## Wording

Write the app's text and the pages it shows the way a course site such as KodeKloud does. Full sentences are fine. These five habits are not:

- Text that describes the app itself, what it stores, or how its screens behave. Show the thing instead.
- Terms invented while building. Use the words a learner already knows: lab, quiz, practice exam, score. Never "starting state", "Recall", "timed run" or "ticks".
- Text from the author's side, such as "not written" or "this exercise names no lab". Say what the learner sees: "Coming soon", "This topic has no lab."
- Headings that are phrases instead of names. Use "Dashboard", "Lab", "Practice", "Solution", not "Where you are" or "Practice it".
- Coaching the learner or explaining edge cases they didn't ask about, such as "Answer each one in your head before you open it."

## App

Run `cd app && pnpm test` after changing the app or the README format it reads.
