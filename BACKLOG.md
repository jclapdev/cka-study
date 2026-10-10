# Backlog

Fix these in order before building more topics. Compared with KodeKloud's CKA course and the kubernetes.io task pages.

## Structure

- [x] 1. Split each topic into short lessons in the sidebar (Find a chart, Install a release, …), followed by Quiz and Practice. Helm is 491 lines on one page; KodeKloud splits Helm into 7 lessons.
- [x] 2. Replace the four tabs (Learn, Lab, Exercise, References) with one path: the Learn text opens the topic, the steps follow, the lab sits beside it, and references are plain links.
- [x] 3. Take domain and topic names from the README table instead of folder names, using short names such as "Helm", "etcd Backup and Restore" and "Network Troubleshooting".
- [x] 4. Make "Mock Exams" its own section at the bottom of the sidebar.

## Wording

- [x] 5. Cut "exam" (121 uses). Rename "Exam skills / Exam workflow" to "kubectl Essentials / Working with kubectl", `references/exam-workflow.md` to `references/kubectl.md`, "Exam readiness" to "Domains" and "Exam guide" to "About the CKA".
- [x] 6. Link a term only the first time it appears on a page, and never as a trailing ": [link]". Helm has 33 links and 8 trailing ones.
- [x] 7. Rewrite lesson text written from the author's side, such as "The lab installed one release, `legacy`, for the Practice section to find."
- [x] 8. Remove developer text from the app: "No grade.sh", "No Practice section", "Unknown intent".
- [x] 9. Shorten topic titles: "Installing and Managing Applications with Helm" becomes "Helm".

## App

- [x] 10. A button to hide and show the sidebar.

## Then

- [x] 11. Apply 1–9 to the 6 finished topics, their Learn pages and their references.
- [x] 12. Update the `build-exercise` skill and `CLAUDE.md` so new topics come out this way.
- [ ] 13. Build the remaining 22 topics, then the mock exams.

## Missing, compared with KodeKloud

Quoted from KodeKloud's CKA course on notes.kodekloud.com: the lessons "Pods with YAML" and "Solution Pods optional", and the course's lesson list.

- [x] 14. Explain every output. KodeKloud follows each output with what it means: "The READY column uses an X/Y format, where X represents the number of containers ready, and Y is the total containers in the pod."
- [x] 15. Explain each part before the command. "Pods with YAML" says "Every Kubernetes definition file must include the following four fields:" and gives each its own paragraph, such as "This field indicates the version of the Kubernetes API you are using.", before running `kubectl create -f pod-definition.yaml`.
- [x] 16. Teach the objects before the topic that uses them. KodeKloud's Core Concepts section has "Pods", "Pods with YAML", "ReplicaSets", "Deployments", "Services", "Namespaces", "Imperative vs Declarative" and "Kubectl Apply Command". Our first topic, Working with kubectl, creates Deployments, Services, ConfigMaps, Secrets and a NetworkPolicy with at most one line on each.
- [x] 17. Background lessons. KodeKloud has "ETCD for Beginners", "Docker vs ContainerD", "TLS Basics", "Prerequisite DNS", "Prerequisite Network Namespaces", "Prerequisite Switching Routing Gateways CNI in kubernetes" and "Storage in Docker". We have no Learn page on etcd, TLS, DNS, network namespaces or storage.
- [x] 18. Explained solutions. KodeKloud's solutions say what each result shows: "The above confirms that the image used in the pod is busybox." and "All listed pods are running on the controlplane node." Our Practice solutions are commands only.
- [x] 19. Hints. KodeKloud has "The hints and solutions panel, visible with each question". Our Practice tasks have a solution and no hint.
- [x] 20. Marked as you go. On KodeKloud "each question is marked as you progress." Ours checks only after **Finish**, and the learner marks the passed tasks by hand before **Save score**.

## Looks wrong

Found by clicking through the app in a browser at 1440px and 390px wide, and compared with React's docs, Docusaurus, MDN and KodeKloud's CKA notes. `cd app && pnpm test:browser` checks 21, 24 and 26 on every lesson.

- [x] 21. Next opened the new lesson mid-page: its title was 1,194px above the screen. On the other four sites the next page opens with its title 122–205px from the top.
- [x] 22. Previous and Next looked different: a solid blue block beside an outline, at different widths. They are now two matching cards, as on Docusaurus and KodeKloud.
- [x] 23. A 220px Notes box sat below Next, so the lesson did not end there. Notes is now a closed section above Previous and Next.
- [x] 24. On a phone, lesson pages covered the top bar, so the topic list could not be reached.
- [x] 25. On a phone, the lab took half the screen before it had started. It is now one Start lab bar until the lab runs.
- [x] 26. Quiz questions showed raw backticks, such as `` `--set image.tag=x` ``.
- [x] 27. Inline code broke at its hyphens: `--version` split into "--" and "version" across two lines.
- [x] 28. Code blocks were cut off on the right with no sign there was more. A shadow now shows on the right edge.
- [x] 29. Each dashboard domain bar had an unlabelled black tick at 66%. Each row now reads "pass mark 66%".
- [x] 30. The dashboard wrote "0 of 35 steps" in one place and "0/35" in another.
- [x] 31. 23 "Coming soon" rows filled most of the dashboard. Each domain now has one "Coming soon:" line.
- [x] 32. An empty grey bar under every sidebar topic looked like a divider. The bar shows once a topic is started.
- [x] 33. "25%" beside a domain in the sidebar read as progress. The exam share stays on the dashboard.
- [x] 34. Double-clicking the divider set the lesson back to half the width, but a reload brought back the old width.
