# The lab

The lab is three Ubuntu 24.04 virtual machines running on your Mac. Every command in every exercise runs on one of these machines, never on the Mac itself. The exercises only say which machine a command runs on; this page covers how to get there.

| Machine | Role | CPUs | Memory |
| --- | --- | --- | --- |
| `controlplane` | Control plane. Almost all work happens here. | 2 | 4 GiB |
| `node01` | Worker | 2 | 2 GiB |
| `node02` | Worker | 2 | 2 GiB |

The machines run under [lima](https://lima-vm.io), a tool that creates and runs Linux virtual machines on macOS. You use it through the `limactl` command. The machines share one network, `192.168.104.0/24`, so they can reach each other, and each has passwordless `sudo`.

Each machine has containerd, kubelet, kubeadm and kubectl installed at Kubernetes 1.34. The exam runs 1.35, so the lab is one version behind on purpose: the cluster-upgrade exercise upgrades it to exactly the exam's version.

## First-time setup

Do this once, in a terminal on your Mac, inside this project's folder (`cd ~/projects/cka-prep`). It needs an Apple silicon Mac with [Homebrew](https://brew.sh), about 8 GiB of free memory, 45 GiB of free disk for the machines, and 45 GiB more for each saved copy.

1. Install lima:

   ```shell
   brew install lima
   ```

2. Build the three machines. This takes about 20 minutes and ends by printing their IP addresses:

   ```shell
   lab/provision.sh
   ```

3. Save a copy of the bare machines, so you can always return to them:

   ```shell
   lab/snapshot.sh save clean
   ```

## Starting states

Each exercise starts from one of the starting states below, and names it at the top. A starting state is a saved copy of all three machines, called a snapshot. Restoring one puts the machines back exactly as they were when it was saved, whatever you did to them since.

Restoring copies three disk images and takes a few minutes.

### vms

Three bare machines with the Kubernetes tools installed and no cluster yet.

In a terminal on your Mac, run:

```shell
cd ~/projects/cka-prep
lab/snapshot.sh restore clean
limactl start controlplane && limactl start node01 && limactl start node02
limactl shell controlplane
```

The first command moves into this project's folder. The second puts all three machines back to bare, which takes a few minutes. The third starts them, and the last opens a shell on `controlplane`. The exercise's commands run in that shell.

If `restore` says `no backup controlplane-clean`, do [first-time setup](README.md#first-time-setup) first.

### cluster

A working three-node cluster, built with kubeadm, with the Flannel pod network and both workers labelled.

In a terminal on your Mac, run:

```shell
cd ~/projects/cka-prep
lab/snapshot.sh restore built
limactl start controlplane && limactl start node01 && limactl start node02
limactl shell controlplane
```

The first command moves into this project's folder. The second puts all three machines back to the saved working cluster, which takes a few minutes. The third starts them, and the last opens a shell on `controlplane`. The exercise's commands run in that shell.

If `restore` says `no backup controlplane-built`, the working cluster has not been saved yet. In the same terminal on your Mac, do one of these, then run the commands above again:

* Finish the [kubeadm exercise](../01-cluster-architecture/00-kubeadm-install/README.md), then save what you built:

  ```shell
  lab/snapshot.sh save built
  ```

* Or have the lab build the cluster for you, then save it:

  ```shell
  lab/provision.sh --auto
  lab/snapshot.sh save built
  ```

### helm

The `cluster` starting state with Helm installed on `controlplane`.

In a terminal on your Mac, run:

```shell
cd ~/projects/cka-prep
lab/snapshot.sh restore built
limactl start controlplane && limactl start node01 && limactl start node02
01-cluster-architecture/02-helm/setup.sh
limactl shell controlplane
```

The first three commands are the same as for `cluster`. The fourth downloads the latest Helm release onto `controlplane` and prints its version, and the last opens a shell there. The exercise's commands run in that shell.

If `restore` says `no backup controlplane-built`, follow the note under [`cluster`](#cluster) first.

## Moving between machines

When an exercise says "on `node01`", open a shell on that machine. From the Mac, in a second terminal:

```shell
limactl shell node01
```

`exit` returns to the Mac. The exam does the same thing with `ssh node01`.

`kubectl` only works on `controlplane`, because only it has the admin kubeconfig. On a worker it fails with `localhost:8080 was refused`.

## After an exercise

Nothing is needed. The next exercise restores its own starting state, which throws away whatever you changed. The machines keep running until you stop them:

```shell
limactl stop controlplane node01 node02
```

## Commands

Every lab command, run in a terminal on your Mac inside this project's folder (`cd ~/projects/cka-prep`).

| Command | What it does |
| --- | --- |
| `lab/provision.sh` | Creates the machines and installs the Kubernetes tools. Safe to re-run; it skips what exists. |
| `lab/provision.sh --auto` | Does the same, then builds a cluster with kubeadm and Flannel. |
| `limactl start controlplane && limactl start node01 && limactl start node02` | Starts the machines. |
| `limactl stop controlplane node01 node02` | Stops the machines. |
| `limactl shell <machine>` | Opens a shell on a machine. |
| `lab/snapshot.sh save <name>` | Saves a copy of all three machines under a name, replacing any copy with that name, then restarts them. |
| `lab/snapshot.sh restore <name>` | Puts all three machines back to that copy and leaves them stopped. |
| `lab/snapshot.sh list` | Lists the machines and saved copies. |

Saving over `clean` leaves no way back to bare machines short of deleting them and running `lab/provision.sh` again.

An exercise that needs more than a restore, such as an add-on installed or a component broken on purpose, has a `setup.sh` in its own folder, and its starting state above runs it.

## When something goes wrong

**The wrong IP address.** Each machine has two addresses. The one on `192.168.104.0/24` reaches the other machines. The other is a private address lima uses to talk to the machine; it reaches nothing else, although it looks just as valid in `ip addr`. This command prints the right one:

```shell
ip route get 1.1.1.1 | awk '{print $7; exit}'
```

**`kubeadm join` times out.** The worker cannot reach `controlplane` on port 6443. It almost always means `kubeadm init` was given the private address instead of the `192.168.104.x` one. The address is written into the cluster's certificates, so the fix is `sudo kubeadm reset -f` on every machine and a new `kubeadm init` on `controlplane`. Restoring the `vms` starting state is faster.

**The machines cannot reach each other at all.** They were created with a lima network mode other than `user-v2`. The `vzNAT` mode gives each machine its own private network, so the Mac reaches every machine but no machine reaches another. `lab/node.yaml` sets `user-v2`; recreate the machines from it.
