# Getting started

Every exercise runs on four practice machines that the app starts for you, never on your own computer.

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

3. Open <http://localhost:5173> and press **Start lab** on the dashboard.

The first lab you start builds the machines, which takes about 6 minutes. [Labs](labs/README.md) lists every lab, its machines, and how long a start takes.

## Using the app

Each topic is a short course of lessons, listed under it in the sidebar: an introduction, how the technology works, one lesson per task with steps to tick off, a quiz, and a practice exam. The lab the topic needs sits beside each lesson, with **Start lab** to start it.

**Open terminal** opens a shell on `base` beside the page. Copy with Ctrl+Shift+C and paste with Ctrl+Shift+V, the same keys as the exam terminal.

To clear your progress and scores, delete `app/data/progress.db`.

## Grading

A topic whose practice exam can be graded shows **Check my work** after you press **Finish**.

It checks only the cluster's final state, one sub-task at a time, and prints each result, each task's share of its weight, and the total against the 66% pass mark. How you got there is never checked, which is how the exam grades. Mark the tasks it passed, then press **Save score**.

## Differences from the exam

* Swap, kernel modules and kernel settings such as `net.ipv4.ip_forward` are already handled here. On the exam, check them yourself, because [kubeadm](../references/kubeadm.md)'s preflight checks report them.
* `free`, `top` and `kubectl describe node` show your computer's memory and CPU, not one machine's.

## Commands

Run these inside this project's folder.

| Command | What it does |
| --- | --- |
| `docker compose up -d` | Starts the app. |
| `docker compose --profile lab down` | Stops the app and the machines. |
| `docker exec -it -u ubuntu base bash` | Opens a shell on `base`, the same as **Open terminal**. Use another machine's name to open a shell on it directly. |
| `docker compose exec app lab/lab.sh rebuild <lab>` | Sets up a lab from scratch on top of the lab it builds on, such as `rebuild helm`. `rebuild vms` rebuilds the machines too. |
| `docker image rm cka-controlplane:<lab> cka-node01:<lab> cka-node02:<lab>` | Frees the disk a lab's saved copy uses. Its next start sets it up again. |

## Troubleshooting

**Start lab fails with `Cannot connect to the Docker daemon`.** Docker is not running. Start Docker Desktop, or on Linux run `sudo systemctl start docker`, and press **Start lab** again.

**`kubeadm init` fails in `wait-control-plane`.** The [kubelet](../references/control-plane.md#components) could not start the [control plane](../references/control-plane.md). Read why with `sudo journalctl -u kubelet | tail -20` on `controlplane`. `lab/lab.sh rebuild cluster` (see [Commands](#commands)) sets the cluster up again.

**The machines are slow or stop at random.** Docker has too little memory. In Docker Desktop, open **Settings**, then **Resources**, and give it at least 4 GiB.
