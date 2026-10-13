# What's new

Changes to the app, newest first.

## 13 October 2026

- Lessons, Learn pages and reference sections are now named for what they cover, such as **Pods**, **ReplicaSets**, **RoleBindings** and **TLS basics**, instead of "Run a pod" or "How TLS secures the cluster". Check your work is now **Verification**.

## 12 October 2026

- Lessons now check your work with short commands such as `k api-resources`, `k describe` and `k get … -o wide`, then say which lines of the output to read.
- **Quit** and **Finish** on a practice exam, the timed set of tasks at the end of each topic, now ask first. **Start** and **Reset lab**, which starts the practice machines over, already did.
- Every lesson can now get its ✓, the mark in the sidebar for a finished lesson.
- When a lab doesn't start, the message links Troubleshooting in Getting started.
- Copy buttons sit only on commands and YAML, not on command output.
- On the Dashboard, the app's home page, an exam domain with no topics yet says Coming soon, and a domain's progress bar appears once one of its topics has a saved practice exam score.
- The notes box under each lesson, where you keep your own notes, says Saved only after it has saved something.

## 11 October 2026

- The Dashboard is the app's home page, and the first link in the sidebar. Its **Continue** button opens the lesson you were last reading.
- Reloading a lesson keeps your place in it and leaves the terminal beside it as you left it.
- Each topic starts its own lab. Starting a lab in another topic asks first, since it ends the lab that was running.
- After **Reset lab**, the button above the terminal, every browser tab or window with the app open shows a fresh terminal.
- A lab stops after an hour with no terminal open.
- **Open in new window**, beside **Reset lab**, puts a topic's terminal tabs in their own window. The window closes when the topic's lab ends. The button shows only on wide screens.
- Each topic ends with a practice exam, a timed set of tasks done in the lab. Its clock now starts once the lab is ready, and reloading the page or opening another lesson no longer ends the exam.
- The sidebar lists each topic's lessons. A lesson gets a ✓ there when it is done, and a topic is finished when all its lessons are.
- The notes box at the bottom of each lesson now saves as soon as you click away or leave the page.
- Each topic's quiz has a **Show missed only** box, which lists the questions you marked **Missed it**. It now turns off once no missed questions are left.
- The terminal and diagrams follow a switch between light and dark mode.
- If Kubernetes fails to start, the lab now says so instead of opening.
- Each lesson's numbered steps have a circle you click to check the step off. Your checked-off steps now stay checked after the course is updated.
