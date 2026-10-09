# Getting started

## Requirements

* Windows 10 or 11, macOS, or Linux.
* About 4 GiB of free memory and 25 GiB of free disk.
* [Docker Desktop](https://docs.docker.com/desktop/) on Windows or macOS, or [Docker Engine](https://docs.docker.com/engine/install/) on Linux.

## Setup

1. Start Docker.
2. In a terminal, inside this project's folder, start the app:

   ```shell
   docker compose up -d
   ```

3. Open <http://localhost:5173>.

## Using the app

Each topic is a short course of lessons, listed under it in the sidebar: an introduction, how the technology works, one lesson per task with steps to tick off, a quiz, and a practice exam.

A topic with a lab shows a terminal beside each lesson. Press **Start lab** and wait for the shell. The first start takes about 6 minutes, later ones under a minute. **Reset** starts the lab over, and so does starting the practice exam. Copy with Ctrl+Shift+C and paste with Ctrl+Shift+V, the same keys as the CKA terminal.

## Grading

During a practice exam, each task has a **Check** button that marks it: each sub-task passed or failed, and the task's share of its weight. **Finish** checks every task and adds up the score against the 66% pass mark, which **Save score** keeps.

Only the cluster's final state is checked, never how you got there, which is how the CKA grades. If the lab is not running, start it and press **Check again**, or mark the tasks you passed yourself.

## Commands

Run these inside this project's folder.

| Command | What it does |
| --- | --- |
| `docker compose up -d` | Starts the app. |
| `docker compose --profile lab down` | Stops the app and the machines. |

## Troubleshooting

**`kubeadm init` fails in `wait-control-plane`.** The [kubelet](../references/control-plane.md#components) could not start the [control plane](../references/control-plane.md). Read why with `sudo journalctl -u kubelet | tail -20` on `controlplane`, then press **Try again**.

**The machines are slow or stop at random.** Docker has too little memory. In Docker Desktop, open **Settings**, then **Resources**, and give it at least 4 GiB.
