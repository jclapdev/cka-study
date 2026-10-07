# Getting started

Every exercise runs on four practice machines: `base`, `controlplane`, `node01` and `node02`.

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

The first lab you start takes about 6 minutes.

## Using the app

Each topic is a short course of lessons, listed under it in the sidebar: an introduction, how the technology works, one lesson per task with steps to tick off, a quiz, and a practice exam. The lab the topic needs sits beside each lesson, with **Start lab** to start it. Starting a lab resets all four machines.

**Open terminal** opens a shell on `base` beside the page. Copy with Ctrl+Shift+C and paste with Ctrl+Shift+V, the same keys as the CKA terminal.

## Machines

| Machine | Role |
| --- | --- |
| `base` | Where you start, as in the CKA. It has no Kubernetes tools; you `ssh` from it to the others. |
| `controlplane` | Control plane. Almost all work happens here. |
| `node01` | Worker |
| `node02` | Worker |

The cluster runs Kubernetes 1.34. Every machine has passwordless `sudo`.

Reach the machine a step or task names with `ssh`:

```shell
ssh controlplane   # or node01, node02
sudo -i            # root, when the task needs it
exit               # back to base (twice after sudo -i)
```

Go back to `base` before moving to another machine. ssh from one of `controlplane`, `node01` and `node02` to another is refused, as in the CKA.

`kubectl` works only on `controlplane`. On a worker it fails with `localhost:8080 was refused`. `k` is an alias for `kubectl` with bash completion, as in the CKA.

## Grading

A topic whose practice exam can be graded shows **Check my work** after you press **Finish**.

It checks only the cluster's final state, one sub-task at a time, and prints each result, each task's share of its weight, and the total against the 66% pass mark. How you got there is never checked, which is how the CKA grades. Mark the tasks it passed, then press **Save score**.

## Differences from the CKA

* Swap, kernel modules and kernel settings such as `net.ipv4.ip_forward` are already handled here. In the CKA, check them yourself, because [kubeadm](../references/kubeadm.md)'s preflight checks report them.
* `free`, `top` and `kubectl describe node` show your computer's memory and CPU, not one machine's.

## Commands

Run these inside this project's folder.

| Command | What it does |
| --- | --- |
| `docker compose up -d` | Starts the app. |
| `docker compose --profile lab down` | Stops the app and the machines. |

## Troubleshooting

**Start lab fails with `Cannot connect to the Docker daemon`.** Docker is not running. Start Docker Desktop, or on Linux run `sudo systemctl start docker`, and press **Start lab** again.

**`kubeadm init` fails in `wait-control-plane`.** The [kubelet](../references/control-plane.md#components) could not start the [control plane](../references/control-plane.md). Read why with `sudo journalctl -u kubelet | tail -20` on `controlplane`, then press **Try again**.

**The machines are slow or stop at random.** Docker has too little memory. In Docker Desktop, open **Settings**, then **Resources**, and give it at least 4 GiB.
