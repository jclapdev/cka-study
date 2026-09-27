---
name: build-exercise
description: Use this skill when writing, extending, fixing or finishing a CKA exercise or reference page in this repo. That includes filling in an empty (greyed-out) topic folder such as 02-helm, adding a Recall or Practice it section to an existing exercise, adding a new lab starting state, writing or extending a concept page in references/, and cleaning up an exercise that has filler prose or concepts with no reference page. Use it even when the request only names the topic ("do the etcd backup one", "write up network policies").
---

# Build an exercise

In the study app, each topic page has three tabs, all built from Markdown in this repo:

1. **Set up the lab** is the `### <lab-name>` section of `lab/README.md` that the exercise's lab line names.
2. **Exercise** is the topic's `README.md`.
3. **References** holds every `references/*.md` page the README links to, each with its one-line summary from the table in `references/README.md`.

`01-cluster-architecture/01-rbac/` is the finished example. Match it.

## Checklist

- [ ] 1. Read the topic's competencies in `EXAM.md` and teach only what the exam tests.
- [ ] 2. Pick the starting state. Use `vms` (bare machines) or `cluster` (working cluster) from `lab/README.md`. If the exercise needs something else, add a `### <lab-name>` section under "Starting states" in `lab/README.md`, and put a `setup.sh` in the topic folder when a restore alone isn't enough.
- [ ] 3. Run every command on the lab first and save the real output. Do this for the steps, for each command a reference page will quote, and for each error message a failure-modes table will quote. Nothing that looks like command output is written from memory.
- [ ] 4. Write `<domain>/<topic>/README.md` from [the exercise template](assets/exercise-template.md). Each step is a command, its trimmed output from step 3, one sentence on what to notice, and a link to the reference page that explains it. Every step group links at least one reference page. Explanations belong on reference pages, not in steps.
- [ ] 5. List the concepts the steps rely on. A concept is any term or behaviour a reader needs in order to follow a step, where no earlier topic has taught it. Check each one against `references/`:
  - It has a page: link that page.
  - It is a detail of a concept that already has a page (for example, the roles every subject gets belong to `rbac.md`): add a section to that page.
  - Other topics will use it too (for example, namespaces or API groups): write a new page from [the reference template](assets/reference-template.md).
- [ ] 6. A reference page covers what this and earlier exercises use, plus what `EXAM.md` lists for that concept, and nothing else. Every claim links to the kubernetes.io section that supports it. Before you link a section, fetch the page to confirm the anchor exists. Diagrams are mermaid.
- [ ] 7. Add each new reference page's row to the table in `references/README.md`.
- [ ] 8. Reread every sentence you wrote and delete narration (see Gotchas).
- [ ] 9. Run `scripts/check-doc-links.sh` on every file you touched, and fix or remove each `FAIL`.
- [ ] 10. Set the topic's status in the root `README.md`: **ready** with Practice it, **steps only** without.
- [ ] 11. Run `cd app && pnpm test`. Then run `pnpm dev`, open the topic and check all three tabs: the lab commands show, every step renders, and each reference opens from the list.

## Gotchas

- **Narration** is any sentence about the lesson, the reader, or how much something matters, instead of about Kubernetes. Delete it. These were all removed from the RBAC exercise:
  - Describing the lesson: "In this lesson, you will…", "Nothing here schedules a pod, so nothing waits."
  - Framing importance: "worth recognising on sight", "which is why it is worth reading rather than skimming", "the single most common reason…"
  - Exam coaching with no fact in it: "which is what you want under exam time", "because the exam asks you to read these as often as write them".
  - Punchlines and fragments: "One role, one subject list.", "kubectl says the quiet part out loud."

  A test for each sentence: if deleting it loses no fact about Kubernetes or the lab, delete it.
- kubectl behaviour differs from what memory suggests. `kubectl create role --resource=deployments` fills in the `apps` group by itself, and `kubectl get nodes -n dev` prints no warning. Both were written wrong from memory, and only running them on the lab caught it.
- Test a failure mode on a fresh restore of the starting state, not after `kubeadm reset`. Reset leaves `/etc/cni/net.d/` and `/run/flannel/` behind, and a failure test of the kubeadm exercise gave the wrong result because the next cluster reused them.
- `admin.conf` authenticates in the group `kubeadm:cluster-admins`. `system:masters` belongs to `super-admin.conf`.
- The app finds sections by heading name: `## Recall`, `## Practice it`, `## Check your work`, `## What's next`. Every `##` heading before Recall is treated as a group of steps.
- The lab line must read exactly ``Starts from the [`<lab-name>` lab](../../lab/README.md#<lab-name>).``, and `<lab-name>` must match a `### <lab-name>` heading in `lab/README.md`. Otherwise tab 1 is empty.
- Each Practice it task opens with a bold lead-in, ``**Host `controlplane`, weight 19%.**`` (or ``**Hosts `a`, `b`, weight 25%.**``), and the weights add up to 100. The time budget is a bold ``**N minutes**`` in the section's opening text.
- Recall answers and the Practice it solution use `<details><summary>…</summary>` with a blank line after `</summary>`.
- Reference links in an exercise must be relative (`../../references/<page>.md`), or the References tab won't list the page. Links between reference pages are plain `<page>.md`.
- A step links the section that explains it, not the top of the page: `[values](../../references/helm.md#values)`, with the section's heading as the link text, or the page's name before a generic heading such as `[kubeadm failure modes](…#failure-modes)`. A link on a word inside a sentence keeps the word and still gets the anchor. Link the top of the page only when its opening paragraph is the explanation. The anchor is the heading in lowercase with spaces turned into hyphens and punctuation dropped. A reference page with one section per idea the steps use makes this possible.
- The table row in `references/README.md` must stay in the form `| [<page>](<page>.md) | <what it covers> |`. The app reads it with a pattern, and a page without a row shows up with no summary.
- Exercises never mention `limactl`, snapshots, the Mac or the lab's IP addresses. Those belong only in `lab/README.md`. A step on another machine starts with "On `node01`".
- Check every kubernetes.io claim against the live page, not memory. Flags get removed: `--pod-eviction-timeout` no longer exists, for example.
- Delete wrong content rather than annotating it.
