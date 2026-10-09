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
- [ ] 16. Teach the objects before the topic that uses them. KodeKloud's Core Concepts section has "Pods", "Pods with YAML", "ReplicaSets", "Deployments", "Services", "Namespaces", "Imperative vs Declarative" and "Kubectl Apply Command". Our first topic, Working with kubectl, creates Deployments, Services, ConfigMaps, Secrets and a NetworkPolicy with at most one line on each.
- [ ] 17. Background lessons. KodeKloud has "ETCD for Beginners", "Docker vs ContainerD", "TLS Basics", "Prerequisite DNS", "Prerequisite Network Namespaces", "Prerequisite Switching Routing Gateways CNI in kubernetes" and "Storage in Docker". We have no Learn page on etcd, TLS, DNS, network namespaces or storage.
- [ ] 18. Explained solutions. KodeKloud's solutions say what each result shows: "The above confirms that the image used in the pod is busybox." and "All listed pods are running on the controlplane node." Our Practice solutions are commands only.
- [ ] 19. Hints. KodeKloud has "The hints and solutions panel, visible with each question". Our Practice tasks have a solution and no hint.
- [ ] 20. Marked as you go. On KodeKloud "each question is marked as you progress." Ours checks only after **Finish**, and the learner marks the passed tasks by hand before **Save score**.
