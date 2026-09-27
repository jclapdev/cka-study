# Writing exercises in this repo

The reader is studying for the CKA. [README.md](README.md) is the entry point and lists every topic with its status. [lab/README.md](lab/README.md) covers the VMs and the labs. [EXAM.md](EXAM.md) covers the exam.

## One topic folder, one README

Each topic folder under a domain is one exercise. It holds a `README.md`, plus a `setup.sh` only when the exercise needs more than a snapshot restore. The README has these sections, in order:

1. Title, one paragraph on what you will have built, and the exam domain.
2. Prerequisites.
3. Lab setup: which lab from `lab/README.md` it starts from, and the commands to reach it.
4. Steps: numbered, each with a command and trimmed expected output. Teach only what the exam tests; lab plumbing goes in `lab/README.md`. Explanation goes in `references/` and the step links to it.
5. Recall: questions with the answers in collapsed `<details>` blocks.
6. Practice it: the same result in exam wording. Each task names its host and its weight as a percentage, with no steps. The solution follows in a collapsed `<details>` block.
7. Check your work: commands that prove each task worked, with expected output.
8. Clean up.
9. What's next: links to kubernetes.io.

The study app in `app/` parses these sections by their headings, so keep the heading names above. It reads each Practice it task's weight and hosts from a bold lead-in in the form ``**Host `controlplane`, weight 19%.**``, and the time budget from a bold `**N minutes**` in that section's opening text. Run `cd app && pnpm test` after changing the format.

When a README gains or completes its Practice it section, update its status in the root README.

## References

Every concept an exercise touches has a summary in `references/`: the model, how it appears in this lab, failure modes, and links to kubernetes.io. Write it with the exercise if missing, extend it if present. Diagrams are mermaid and live there.
