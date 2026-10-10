# Getting started

## Requirements

* Windows 10 or 11, macOS, or Linux.
* About 4 GiB of free memory and 25 GiB of free disk.
* [Docker Desktop](https://docs.docker.com/desktop/) on Windows or macOS, or [Docker Engine](https://docs.docker.com/engine/install/) on Linux.
* [Git](https://git-scm.com/downloads), to download the course.

## Setup

1. Start Docker.
2. In a terminal, download the course and go into its folder:

   ```shell
   git clone https://github.com/jclapdev/cka-study.git
   cd cka-study
   ```

3. Start the app:

   ```shell
   docker compose up -d
   ```

4. Open <http://localhost:5173>.

## Using the app

Each topic is a short course of lessons, listed under it in the sidebar: an introduction, how the technology works, one lesson per task with steps to tick off, a quiz, and a practice exam.

Most topics have a lab: a set of practice machines, running on your computer, that you work on through a terminal shown beside each lesson. Press **Start lab** and wait for the shell. The first start takes about 6 minutes, later ones under a minute. If the lab doesn't start, the button changes to **Try again**.

The cluster is the set of machines running Kubernetes. The shell opens on `base`, a machine outside the cluster, because the Certified Kubernetes Administrator (CKA) exam this course prepares you for starts you on one too. From `base` you reach the cluster's machines with `ssh` and do the work there. `controlplane` is the one that runs the parts managing the cluster, and `kubectl`, the command you use to work with Kubernetes, is set up only there. So run `ssh controlplane` first. Each topic's introduction names the machines in its lab.

**+** opens another terminal, up to four, so you can keep one command running while you work in another. After `exit`, press Enter for a new shell. **Reset lab** starts the lab over, and so does starting the practice exam. Copy with Ctrl+Shift+C and paste with Ctrl+Shift+V, the keys the CKA exam's terminal uses, so you practise them, or right-click for Copy and Paste.

## Grading

During a practice exam, each task shows its weight, the percent of the total score it is worth, and a **Check** button. **Check** lists each part of the task as passed or failed, and how much of the task's weight you earned. **Finish** checks every task and adds up the score against the 66% pass mark, which **Save score** keeps.

Only the cluster's final state is checked, never how you got there, which is how the CKA grades. If the lab is not running when you press **Finish**, the tasks can't be checked: a message says so, with a **Check again** button beside it. Start the lab and press **Check again**, or tick the box beside each task you passed, and the score adds up from those.

## Commands

Run these inside this project's folder.

| Command | What it does |
| --- | --- |
| `docker compose up -d` | Starts the app. |
| `docker compose --profile lab down` | Stops the app and the machines. |

## Troubleshooting

**The lab says "The lab didn't start."** Usually Kubernetes on `controlplane` failed to come up. The [kubelet](../references/control-plane.md#components) is the program on each machine that starts Kubernetes' parts, and its log says why it couldn't. To read the last lines of that log, open a terminal on your own computer, not the one in the app, and run this inside this project's folder:

```shell
docker compose exec controlplane journalctl -u kubelet --no-pager | tail -20
```

Errors are the lines whose message starts with `E` and the date, such as `E1009`; the last one is usually the cause. Then press **Try again**.

**The machines are slow or stop at random.** Docker has too little memory. In Docker Desktop, open **Settings**, then **Resources**, and give it at least 4 GiB.
