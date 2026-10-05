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

3. Open <http://localhost:5173>, open any topic, and press **Start lab** on its **Lab** tab.

The first **Start lab** builds the machines and a working cluster. It takes about 6 minutes. Every later **Start lab** takes under a minute.

## Using the app

Each topic has three tabs. **Lab** starts the machines the topic needs, **Exercise** holds the steps, quiz and practice exam, and **References** holds the concept pages the exercise links to.

**Open terminal** opens a shell on `base` beside the page. Copy with Ctrl+Shift+C and paste with Ctrl+Shift+V, the same keys as the exam terminal.

Starting a lab resets all four machines, so nothing needs cleaning up after an exercise. To clear your progress and scores, delete `app/data/progress.db`.

## Machines

| Machine | Role | Address |
| --- | --- | --- |
| `base` | Where you start, as in the exam. It has no Kubernetes tools; you `ssh` from it to the others. | `192.168.104.2` |
| `controlplane` | Control plane. Almost all work happens here. | `192.168.104.10` |
| `node01` | Worker | `192.168.104.11` |
| `node02` | Worker | `192.168.104.12` |

The cluster runs Kubernetes 1.34, one version behind the exam's 1.35, so the cluster-upgrade exercise can upgrade it to exactly the exam's version. Every machine has passwordless `sudo`.

Reach the machine a step or task names with `ssh`:

```shell
ssh controlplane   # or node01, node02
sudo -i            # root, when the task needs it
exit               # back to base (twice after sudo -i)
```

Go back to `base` before moving to another machine. ssh from one of `controlplane`, `node01` and `node02` to another is refused, as in the exam.

`kubectl` works only on `controlplane`. On a worker it fails with `localhost:8080 was refused`. `k` is an alias for `kubectl` with bash completion, as in the exam.

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
| `docker compose exec app lab/lab.sh setup` | Rebuilds the machines from scratch. |

## Troubleshooting

**Start lab fails with `Cannot connect to the Docker daemon`.** Docker is not running. Start Docker Desktop, or on Linux run `sudo systemctl start docker`, and press **Start lab** again.

**`kubeadm init` fails in `wait-control-plane`.** The [kubelet](../references/control-plane.md#components) could not start the [control plane](../references/control-plane.md). Read why with `sudo journalctl -u kubelet | tail -20` on `controlplane`. Starting the `vms` lab again gives three fresh machines.

**The machines are slow or stop at random.** Docker has too little memory. In Docker Desktop, open **Settings**, then **Resources**, and give it at least 4 GiB.
