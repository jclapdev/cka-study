# The lab

The lab is four Ubuntu 24.04 virtual machines running on your Mac. Every command in every exercise runs on one of these machines, never on the Mac itself. The study app prepares them and gives you a terminal on them; the Mac's own terminal is needed only for first-time setup and the commands at the end of this page. The exercises only say which machine a command runs on; this page covers how to get there.

| Machine | Role | CPUs | Memory |
| --- | --- | --- | --- |
| `base` | Where you start, as in the exam. It has no Kubernetes tools; you `ssh` from it to the others. | 1 | 1 GiB |
| `controlplane` | Control plane. Almost all work happens here. | 2 | 4 GiB |
| `node01` | Worker | 2 | 2 GiB |
| `node02` | Worker | 2 | 2 GiB |

The machines run under [lima](https://lima-vm.io), a tool that creates and runs Linux virtual machines on macOS. You use it through the `limactl` command. The machines share one network, `192.168.104.0/24`, so they can reach each other, and each has passwordless `sudo`.

`controlplane`, `node01` and `node02` have containerd, kubelet, kubeadm and kubectl installed at Kubernetes 1.34. The exam runs 1.35, so the lab is one version behind on purpose: the cluster-upgrade exercise upgrades it to exactly the exam's version.

## First-time setup

Do this once, in a terminal on the Mac, inside this project's folder (`cd ~/projects/cka-prep`). It needs an Apple silicon Mac with [Homebrew](https://brew.sh), about 9 GiB of free memory, 55 GiB of free disk for the machines, and 45 GiB more for each saved copy.

1. Install lima:

   ```shell
   brew install lima
   ```

2. Build the four machines. This takes about 20 minutes and ends by printing the cluster machines' IP addresses:

   ```shell
   lab/provision.sh
   ```

3. Set the machines up the way the exam's hosts are: `ssh controlplane`, `ssh node01` and `ssh node02` work from `base` without a password, ssh from one of those three to another does not, and each of the three has the `k` alias with bash completion and `yq`:

   ```shell
   lab/exam-mode.sh
   ```

4. Save a copy of the bare machines, so you can always return to them:

   ```shell
   lab/snapshot.sh save clean
   ```

## Starting states

Each exercise starts from one of the starting states below and names it at the top. A starting state is a saved copy of `controlplane`, `node01` and `node02`, plus a setup script for some. Preparing one puts those machines back exactly as they were saved, whatever you did to them since. `base` is not in the saved copies, because no exercise changes it.

To prepare a starting state, press **Prepare lab** on the topic's Set up the lab tab in the study app. It shows the output as it goes and takes about a minute. Then open the terminal. Without the app, run `lab/start.sh <state>` in a terminal on the Mac, inside this project's folder, then `limactl shell base`.

### vms

Three bare machines with the Kubernetes tools installed and no cluster yet. Press **Prepare lab**, or run `lab/start.sh vms`.

If it says `no backup controlplane-clean`, do [first-time setup](README.md#first-time-setup) first.

### cluster

A working three-node cluster, built with kubeadm, with the Flannel pod network and both workers labelled. Press **Prepare lab**, or run `lab/start.sh cluster`.

If it says `no backup controlplane-built`, the working cluster has not been saved yet. In a terminal on the Mac, inside this project's folder, do one of these, then prepare the lab again:

* Finish the [kubeadm exercise](../01-cluster-architecture/00-kubeadm-install/README.md), then save what you built:

  ```shell
  lab/snapshot.sh save built
  ```

* Or have the lab build the cluster for you, then save it:

  ```shell
  lab/provision.sh --auto
  lab/exam-mode.sh
  lab/snapshot.sh save built
  ```

### helm

The `cluster` starting state with Helm installed on `controlplane`, and one release, `legacy`, that Practice it task 5 has to find. Press **Prepare lab**, or run `lab/start.sh helm`. It downloads the latest Helm onto `controlplane`, installs `legacy`, and prints Helm's version.

If it says `no backup controlplane-built`, follow the note under [`cluster`](#cluster) first.

### kustomize

The `cluster` starting state with the files Practice it task 3 hands over, under `/opt/course/3`. Press **Prepare lab**, or run `lab/start.sh kustomize`. It writes the task's files and lists them.

If it says `no backup controlplane-built`, follow the note under [`cluster`](#cluster) first.

### crds

The `cluster` starting state with Helm installed on `controlplane`, and empty folders under `/opt/course` for Practice it's answers. Press **Prepare lab**, or run `lab/start.sh crds`. It installs Helm and prints its version.

If it says `no backup controlplane-built`, follow the note under [`cluster`](#cluster) first.

## Moving between machines

You start on `base`, as in the exam. `base` has no `kubectl`, `k` or `yq`, so all work happens on the machine a step or task names, reached with `ssh`:

```shell
ssh controlplane   # or node01, node02
sudo -i            # root, when the task needs it
exit               # back to base (twice after sudo -i)
```

Go back to `base` before moving to another machine. ssh from one of `controlplane`, `node01` and `node02` to another is refused, because the exam does not support it either.

The study app's terminal, opened with **Open terminal** on a topic page, starts on `base`. From a terminal on the Mac, `limactl shell base` does the same, and `limactl shell <machine>` opens a shell on any machine directly.

`kubectl` only works on `controlplane`, because only it has the admin kubeconfig. On a worker it fails with `localhost:8080 was refused`. `k` is an alias for `kubectl` with bash completion, as in the exam.

If `base` is stopped, `limactl shell base` and the study app's terminal ask `Do you want to start the instance now?`. Answer `Y`.

## Grading

A topic whose Practice it can be graded has a `grade.sh` in its folder. After a timed run, press **Finish and mark**, then **Run grader**. Without the app, run the script in a terminal on the Mac, inside this project's folder, for example `01-cluster-architecture/03-kustomize/grade.sh`.

It checks only the cluster's final state, one sub-task at a time, and prints each result, each task's share of its weight, and the total against the 66% pass mark. How you got there is never checked, which is how the exam grades. Tick the tasks it passed to keep the score with your notes.

## After an exercise

Nothing is needed. The next exercise prepares its own starting state, which throws away whatever you changed. The machines keep running until you stop them, in a terminal on the Mac:

```shell
limactl stop controlplane node01 node02 base
```

## Commands

Every lab command, run in a terminal on the Mac inside this project's folder (`cd ~/projects/cka-prep`). The study app runs `lab/start.sh` and `grade.sh` for you.

| Command | What it does |
| --- | --- |
| `lab/provision.sh` | Creates the machines and installs the Kubernetes tools. Safe to re-run; it skips what exists. |
| `lab/provision.sh --auto` | Does the same, then builds a cluster with kubeadm and Flannel. |
| `lab/start.sh <state>` | Prepares a starting state: restores its saved copy, starts all four machines, and runs its setup script. What **Prepare lab** runs. |
| `limactl start controlplane && limactl start node01 && limactl start node02 && limactl start base` | Starts the machines. |
| `limactl stop controlplane node01 node02 base` | Stops the machines. |
| `limactl shell <machine>` | Opens a shell on a machine. The study app's terminal is `limactl shell base`. |
| `lab/snapshot.sh save <name>` | Saves a copy of `controlplane`, `node01` and `node02` under a name, replacing any copy with that name, then restarts them. |
| `lab/snapshot.sh restore <name>` | Puts those three machines back to that copy and leaves them stopped. `base` is not touched. |
| `lab/snapshot.sh list` | Lists the machines and saved copies. |
| `lab/exam-mode.sh` | Sets up `ssh` from `base` to the other three, removes ssh between those three, and installs the `k` alias and `yq`. Run it after `provision.sh`, before saving. |
| `<topic folder>/grade.sh` | Grades that topic's Practice it on the running machines. What **Run grader** runs. |

Saving over `clean` leaves no way back to bare machines short of deleting them and running `lab/provision.sh` again.

An exercise that needs more than a restore, such as an add-on installed or a component broken on purpose, has a `setup.sh` in its own folder, and `lab/start.sh` runs it for that starting state.

## When something goes wrong

**The wrong IP address.** Each machine has two addresses. The one on `192.168.104.0/24` reaches the other machines. The other is a private address lima uses to talk to the machine; it reaches nothing else, although it looks just as valid in `ip addr`. This command prints the right one:

```shell
ip route get 1.1.1.1 | awk '{print $7; exit}'
```

**`kubeadm join` times out.** The worker cannot reach `controlplane` on port 6443. It almost always means `kubeadm init` was given the private address instead of the `192.168.104.x` one. The address is written into the cluster's certificates, so the fix is `sudo kubeadm reset -f` on every machine and a new `kubeadm init` on `controlplane`. Restoring the `vms` starting state is faster.

**`ssh controlplane` from `base` says `Permission denied`.** `base` has not been given its key yet. Run `lab/exam-mode.sh` on the Mac with all four machines started.

**The machines cannot reach each other at all.** They were created with a lima network mode other than `user-v2`. The `vzNAT` mode gives each machine its own private network, so the Mac reaches every machine but no machine reaches another. `lab/node.yaml` sets `user-v2`; recreate the machines from it.
