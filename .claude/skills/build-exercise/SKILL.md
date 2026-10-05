---
name: build-exercise
description: Use this skill when writing, extending, fixing or finishing a CKA exercise, reference page or Learn page in this repo. That includes filling in an empty (greyed-out) topic folder such as 02-helm, adding a Quiz or Practice section to an existing exercise, adding a new lab, writing or extending a page in references/ or learn/, and cleaning up an exercise that has filler prose, concepts with no reference page, or a technology it names without explaining ("what is Flannel?"). Use it even when the request only names the topic ("do the etcd backup one", "write up network policies").
---

# Build an exercise

In the study app, each topic page has four tabs, all built from Markdown in this repo:

1. **Learn** holds every `learn/*.md` page the README links to: how a technology works and why, with diagrams and further reading.
2. **Lab** is the `### <lab-name>` section of `lab/labs.md` that the exercise's lab line names.
3. **Exercise** is the topic's `README.md`.
4. **References** holds every `references/*.md` page the README links to: the facts, commands and errors to look up. Each page in either tab shows its one-line summary from the table in that folder's `README.md`.

`01-cluster-architecture/03-kustomize/` is the finished example. Match it.

## Checklist

- [ ] 1. Read the topic's competencies in `EXAM.md` and teach only what the exam tests.
- [ ] 2. Pick the lab. Use `vms` (bare machines) or `cluster` (working cluster) from `lab/labs.md`. If the exercise needs something else, put a `setup.sh` in the topic folder, add a case for the new lab to `start` in `lab/lab.sh` that names a saved copy and the script, and add a `### <lab-name>` section to `lab/labs.md` in the same form as the others. The app's Start lab button refuses a lab with no section.
- [ ] 3. Run every command on the lab first and save the real output. Do this for the steps, for each command a reference page will quote, and for each error message a failure-modes table will quote. Nothing that looks like command output is written from memory.
- [ ] 4. Write `<domain>/<topic>/README.md` from [the exercise template](assets/exercise-template.md). Each step is a command, one sentence on what to notice, and a link to the reference page that explains it. Show the trimmed output from step 3 only when the reader has to read something in it (see Gotchas). Every step group links at least one reference page. Explanations belong on Learn and reference pages, not in steps.
- [ ] 5. Get every manifest the way the exam allows, fastest source first (the "How to work in the exam" section of `EXAM.md`), and never have the reader type a whole manifest:
  1. `kubectl create`, `run` or `expose` with `--dry-run=client -o yaml > file` whenever one of them can write it.
  2. Otherwise, a snippet from a kubernetes.io page. The step names the search term, links the page section with its anchor, says to copy the block and paste it, then shows the lines to change and the finished file. Prefer the docs' own `cat <<EOF` blocks and example files with copy buttons.
  3. `kubectl explain <kind>.<field>` for a field no snippet shows.

  Hand edits happen in `vim`. A step names the file and shows the lines to add or change, never a `sed`, `printf` or script. Steps link only docs the exam allows: kubernetes.io/docs, kubernetes.io/blog, helm.sh/docs and gateway-api.sigs.k8s.io.
- [ ] 6. List the concepts the steps rely on. A concept is any term or behaviour a reader needs in order to follow a step, where no earlier topic has taught it. That includes every named tool, component, plugin, protocol, file format and acronym, such as Flannel, containerd, conflist or CNI. The reader knows Linux and the shell but nothing about Kubernetes: the `known` rows of [the term list](assets/terms.tsv) are what needs no explaining. Check each concept against `references/`:
  - It has a page: link that page.
  - It is a detail of a concept that already has a page (for example, the roles every subject gets belong to `rbac.md`): add a section to that page.
  - Other topics will use it too (for example, namespaces or API groups): write a new page from [the reference template](assets/reference-template.md).
- [ ] 6a. Give each concept one home section and add it to [the term list](assets/terms.tsv). The home section has a plain sentence saying what it is, such as "Flannel is a CNI plugin that…", with an acronym spelled out first. The first mention on every page, reference pages included, links the home section. A term from a topic not built yet, such as NetworkPolicy or PersistentVolume, is listed as `inline` and gets a one-sentence definition in the paragraph where each page first uses it, instead of an early page.
- [ ] 7. A reference page covers what this and earlier exercises use, plus what `EXAM.md` lists for that concept, and nothing else. Every claim links to the kubernetes.io section that supports it. Before you link a section, fetch the page to confirm the anchor exists. A reference page holds facts to look up, not explanations or diagrams of how parts fit together, which go on the Learn page (step 9). A link outside the exam's allowed docs goes only in the page's Docs list, marked "(not available in the exam)".
- [ ] 8. Add each new reference page's row to the table in `references/README.md`.
- [ ] 9. Check that each technology the exercise uses has a Learn page in `learn/`, and write any that is missing from [the Learn template](assets/learn-template.md). A Learn page explains why the technology exists and how its parts work together, with mermaid diagrams, and links the reference pages for the facts. It covers one technology across every topic that uses it, so extend an existing page before writing a new one. Link each Learn page from the README's opening paragraph, and add its row to the table in `learn/README.md`.
- [ ] 10. Write the Practice section the way the exam asks: a host lead-in and weight per task, a solution that starts each task with `ssh <host>` from `base`, and a `setup.sh` that places any files the exam would hand over (for example a kustomization under `/opt/course/<n>/`). The solution uses `k`.
- [ ] 11. Write `grade.sh` in the topic folder from [the grader template](assets/grade-template.sh). One `task` per Practice task with its weight, and one `check` per sub-task that inspects only the final state. Start the lab and run it: it must score 0%. Run the solution and run it again: it must score 100%. The exercise links [grading](../../lab/README.md#grading) and never says how the grader runs.
- [ ] 12. Reread every sentence you wrote. Delete narration, and check the wording rules in `CLAUDE.md` (see Gotchas).
- [ ] 13. Run `scripts/check-doc-links.sh` on every file you touched, and fix or remove each `FAIL` and each `NOT ALLOWED`. Run `scripts/check-terms.py` with no arguments and fix every line it prints. An `UNKNOWN` word is either a new concept (step 6a) or a known word to add to the term list as `known`.
- [ ] 14. Set the topic's status in the root `README.md`: **ready** with Practice, **steps only** without.
- [ ] 15. Run `cd app && pnpm test`. Then run `pnpm dev` and open the topic in a browser. Press Start lab and wait for "The lab is ready", open the terminal and run the first steps from `base`, then check that every step renders, each Learn page and reference opens from its list, and each diagram draws.

## Gotchas

- **Output blocks** are for output the reader has to read: an error to recognise, a table or YAML whose contents are the lesson, or a value a later step uses. Leave the block out when the command only creates or changes something (`created`, `configured`, `labeled`), when the next step checks the result, or for `ssh`, `exit` and `hostname`. Put a one-word or one-line result in the sentence instead: "The answer is `no`." Trim `created` lines from a block that stays.
- **Narration** is any sentence about the lesson, the reader, or how much something matters, instead of about Kubernetes. Delete it. These were all removed from the RBAC exercise:
  - Describing the lesson: "In this lesson, you will…", "Nothing here schedules a pod, so nothing waits."
  - Framing importance: "worth recognising on sight", "which is why it is worth reading rather than skimming", "the single most common reason…"
  - Exam coaching with no fact in it: "which is what you want under exam time", "because the exam asks you to read these as often as write them".
  - Punchlines and fragments: "One role, one subject list.", "kubectl says the quiet part out loud."

  A test for each sentence: if deleting it loses no fact about Kubernetes or the lab, delete it.
- kubectl behaviour differs from what memory suggests. `kubectl create role --resource=deployments` fills in the `apps` group by itself, and `kubectl get nodes -n dev` prints no warning. Both were written wrong from memory, and only running them on the lab caught it.
- Test a failure mode on a freshly started lab, not after `kubeadm reset`. Reset leaves `/etc/cni/net.d/` and `/run/flannel/` behind, and a failure test of the kubeadm exercise gave the wrong result because the next cluster reused them.
- `admin.conf` authenticates in the group `kubeadm:cluster-admins`. `system:masters` belongs to `super-admin.conf`.
- The app finds sections by heading name: `## Quiz`, `## Practice`, `## Check your work`, `## Next`. Every `##` heading before Quiz is treated as a group of steps.
- The lab line must read exactly ``Starts from the [`<lab-name>` lab](../../lab/labs.md#<lab-name>).``, and `<lab-name>` must match a `### <lab-name>` heading in `lab/labs.md`. Otherwise the Lab tab is empty.
- Each Practice task opens with a bold lead-in, ``**Host `controlplane`, weight 19%.**`` (or ``**Hosts `a`, `b`, weight 25%.**``), and the weights add up to 100. The time budget is a bold ``**N minutes**`` in the section's opening text.
- Quiz answers and the Practice solution use `<details><summary>…</summary>` with a blank line after `</summary>`.
- Reference and Learn links in an exercise must be relative (`../../references/<page>.md`, `../../learn/<page>.md`), or the tab won't list the page. Links within one folder are plain `<page>.md`, and between the folders `../references/<page>.md` or `../learn/<page>.md`.
- A Learn page may link sources outside the exam's allowed docs in its Further reading list, each marked "(not available in the exam)". It never mentions how the lab is built.
- A step links the section that explains it, not the top of the page: `[values](../../references/helm.md#values)`, with the section's heading as the link text, or the page's name before a generic heading such as `[kubeadm failure modes](…#failure-modes)`. A link on a word inside a sentence keeps the word and still gets the anchor. Link the top of the page only when its opening paragraph is the explanation. The anchor is the heading in lowercase with spaces turned into hyphens and punctuation dropped. A reference page with one section per idea the steps use makes this possible.
- The table row in `references/README.md` must stay in the form `| [<page>](<page>.md) | <what it covers> |`. The app reads it with a pattern, and a page without a row shows up with no summary.
- Exercises never mention `docker`, saved copies, the computer the lab runs on or the lab's IP addresses. Those belong only in `lab/README.md` and `lab/labs.md`.
- The reader starts on `base`, which has no `kubectl`, as in the exam. Steps run on `controlplane`, reached with `ssh controlplane`. Work on a worker goes `exit` to `base`, `ssh node01`, then `exit` and `ssh controlplane` again. ssh from one cluster machine to another is refused in the lab, as in the exam, so a step that does it fails.
- The exam's hosts share nothing between tasks: each task is a new `ssh` session. Don't teach an alias, an exported variable or a `.vimrc` as setup the reader can rely on later. `k` and its completion exist everywhere, in the lab too (`lab/exam-mode.sh`).
- A grader `check` runs on `controlplane` as the lab user. Use `k` there, `ssh node01 …` for a worker, and `sudo` for root-owned files. `ssh` works inside checks only because `lab/grade-lib.sh` lends `controlplane` a key for the run; the reader's `controlplane` has none. A check that fails on a fresh restore and passes after the solution is the only proof it works.
- `kubectl create deployment` names the container after the image (`nginx` for `nginx:1.27`) and labels the pods `app: <name>`, which is the selector `kubectl create service clusterip <name>` writes. A patch or `envFrom` step must use that container name.
- Check every kubernetes.io claim against the live page, not memory. Flags get removed: `--pod-eviction-timeout` no longer exists, for example.
- Delete wrong content rather than annotating it.
