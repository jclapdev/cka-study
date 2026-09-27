# CKA practice labs

The reader is studying for the CKA. [README.md](README.md) is the entry point and lists every topic with its status. [lab/README.md](lab/README.md) covers the VMs and the labs. [EXAM.md](EXAM.md) covers the exam. `app/` is the study app that shows each topic as three tabs: lab setup, exercise, and references.

## Skills

- Writing or extending an exercise, a lab starting state, or a page in `references/` → use the `build-exercise` skill.

## Lab details live in one place

Everything about the lab lives in `lab/README.md` and nowhere else: the machines, the starting states and how to reach them, opening a shell on another machine, resetting, and lab-specific problems. An exercise names its starting state in its lab line and never mentions `limactl`, snapshots, the Mac or the lab's IP addresses.

## App

Run `cd app && pnpm test` after changing the app or the README format it reads.
