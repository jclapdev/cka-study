# The lab

The lab is four Ubuntu 24.04 machines. Every command in every exercise runs on one of them, never on your own computer.

| Machine | Role | Address |
| --- | --- | --- |
| `base` | Where you start, as in the exam. It has no Kubernetes tools; you `ssh` from it to the others. | `192.168.104.2` |
| `controlplane` | Control plane. Almost all work happens here. | `192.168.104.10` |
| `node01` | Worker | `192.168.104.11` |
| `node02` | Worker | `192.168.104.12` |

Each machine is a Docker container that runs systemd, the way kind, the Kubernetes project's own tool for clusters in Docker, runs its nodes. The machines share one network, `192.168.104.0/24`, and each has passwordless `sudo`.

`controlplane`, `node01` and `node02` have containerd, kubelet, kubeadm and kubectl installed at Kubernetes 1.34, and the control plane images already pulled. The exam runs 1.35, so the lab is one version behind on purpose: the cluster-upgrade exercise upgrades it to exactly the exam's version.

## First-time setup

You need Windows 10 or 11, macOS, or Linux, and about 4 GiB of free memory and 25 GiB of free disk.

1. Install [Docker Desktop](https://docs.docker.com/desktop/) on Windows or macOS, or [Docker Engine](https://docs.docker.com/engine/install/) on Linux, and start it.
2. In a terminal, inside this project's folder, start the app:

   ```shell
   docker compose up -d
   ```

3. Open <http://localhost:5173>, open any topic, and press **Start lab** on its **Lab** tab.

The first **Start lab** builds the machines, builds a working cluster with kubeadm, and saves both. It takes about 6 minutes. Every later **Start lab** takes under a minute.

## Labs

Each exercise uses one of the labs below and names it at the top. A lab is a saved copy of `controlplane`, `node01` and `node02`, plus a setup script for some. Starting a lab puts all four machines back exactly as they were saved, whatever you did to them since.

To start a lab, press **Start lab** on the topic's Lab tab. Then press **Open terminal**.

### vms

Three bare machines with the Kubernetes tools installed and no cluster yet.

### cluster

A working three-node cluster, built with kubeadm, with the Flannel pod network and both workers labelled.

### helm

The `cluster` lab with Helm installed on `controlplane`, and one release, `legacy`, that Practice task 5 has to find.

### kustomize

The `cluster` lab with the files Practice task 3 hands over, under `/opt/course/3`.

### crds

The `cluster` lab with Helm installed on `controlplane`, and empty folders under `/opt/course` for the Practice answers.

## Moving between machines

You start on `base`, as in the exam. `base` has no `kubectl`, `k` or `yq`, so all work happens on the machine a step or task names, reached with `ssh`:

```shell
ssh controlplane   # or node01, node02
sudo -i            # root, when the task needs it
exit               # back to base (twice after sudo -i)
```

Go back to `base` before moving to another machine. ssh from one of `controlplane`, `node01` and `node02` to another is refused, because the exam does not support it either.

`kubectl` only works on `controlplane`, because only it has the admin kubeconfig. On a worker it fails with `localhost:8080 was refused`. `k` is an alias for `kubectl` with bash completion, as in the exam.

## Grading

A topic whose Practice can be graded has a `grade.sh` in its folder. After a practice exam, press **Finish**, then **Check my work**.

It checks only the cluster's final state, one sub-task at a time, and prints each result, each task's share of its weight, and the total against the 66% pass mark. How you got there is never checked, which is how the exam grades. Mark the tasks it passed, then press **Save score**.

## After an exercise

Nothing is needed. Starting the next exercise's lab throws away whatever you changed. The machines keep running until you stop them.

## Commands

Every lab command runs through the app's container, so it works the same in PowerShell, the macOS Terminal and a Linux shell. Run them inside this project's folder.

| Command | What it does |
| --- | --- |
| `docker compose up -d` | Starts the app. |
| `docker compose --profile lab down` | Stops the app and the machines. Saved copies are kept. |
| `docker compose exec app lab/lab.sh start <lab>` | Starts a lab. This is what **Start lab** runs. |
| `docker compose exec app lab/lab.sh stop` | Stops the machines. |
| `docker compose exec app lab/lab.sh save <name>` | Saves a copy of `controlplane`, `node01` and `node02` under a name, replacing any copy with that name. |
| `docker compose exec app lab/lab.sh setup` | Rebuilds the machines and the `clean` and `built` copies that the labs start from. |
| `docker exec -it -u ubuntu base bash` | Opens a shell on `base`, the same as **Open terminal**. Use another machine's name to open a shell on it directly. |
| `docker compose exec app <topic folder>/grade.sh` | Grades that topic's Practice on the running machines. This is what **Check my work** runs. |

An exercise that needs more than a saved copy, such as an add-on installed or a component broken on purpose, has a `setup.sh` in its own folder, and `lab/lab.sh start` runs it for that lab.

## How the lab differs from the exam

The exam's machines are virtual machines, each with its own Linux kernel. The lab's machines share the kernel of Docker's own machine. That changes three things:

* **Preparing a machine for Kubernetes.** `swapoff`, `modprobe` and kernel settings such as `net.ipv4.ip_forward` act on Docker's shared machine, not on one node, and some do nothing. The lab's kubelet is set to start with swap on, and containerd uses the `native` snapshotter instead of `overlayfs`. On the exam, check swap, modules and kernel settings yourself, because kubeadm's preflight checks report them.
* **Memory and CPU.** `free`, `top` and `kubectl describe node` show the totals of Docker's machine, not of one node.
* **Connection tracking.** Docker's machine allows at least 32768 tracked connections per CPU, so kube-proxy starts without having to raise the limit.

## When something goes wrong

**Start lab fails with `Cannot connect to the Docker daemon`.** Docker is not running. Start Docker Desktop, or on Linux run `sudo systemctl start docker`, and press **Start lab** again.

**`kubeadm init` fails in `wait-control-plane`.** The kubelet could not start the control plane. Read why with `sudo journalctl -u kubelet | tail -20` on `controlplane`. Starting the `vms` lab again gives three fresh machines.

**The machines are slow or stop at random.** Docker has too little memory. In Docker Desktop, open **Settings**, then **Resources**, and give it at least 4 GiB.
