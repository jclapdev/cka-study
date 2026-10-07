# Backlog

Fix these in order before building more topics. Compared with KodeKloud's CKA course and the kubernetes.io task pages.

## Structure

- [ ] 1. Split each topic into short lessons in the sidebar (Find a chart, Install a release, …), followed by Quiz and Practice. Helm is 491 lines on one page; KodeKloud splits Helm into 7 lessons.
- [ ] 2. Replace the four tabs (Learn, Lab, Exercise, References) with one path: the Learn text opens the topic, the steps follow, the lab sits beside it, and references are plain links.
- [ ] 3. Take domain and topic names from the README table instead of folder names, using short names such as "Helm", "etcd Backup and Restore" and "Network Troubleshooting".
- [ ] 4. Make "Mock Exams" its own section at the bottom of the sidebar.

## Wording

- [ ] 5. Cut "exam" (121 uses). Rename "Exam skills / Exam workflow" to "kubectl Essentials / Working with kubectl", `references/exam-workflow.md` to `references/kubectl.md`, "Exam readiness" to "Domains" and "Exam guide" to "About the CKA".
- [ ] 6. Link a term only the first time it appears on a page, and never as a trailing ": [link]". Helm has 33 links and 8 trailing ones.
- [ ] 7. Rewrite lesson text written from the author's side, such as "The lab installed one release, `legacy`, for the Practice section to find."
- [ ] 8. Remove developer text from the app: "No grade.sh", "No Practice section", "Unknown intent".
- [ ] 9. Shorten topic titles: "Installing and Managing Applications with Helm" becomes "Helm".

## App

- [x] 10. A button to hide and show the sidebar.

## Then

- [ ] 11. Apply 1–9 to the 6 finished topics, their Learn pages and their references.
- [ ] 12. Update the `build-exercise` skill and `CLAUDE.md` so new topics come out this way.
- [ ] 13. Build the remaining 22 topics, then the mock exams.
