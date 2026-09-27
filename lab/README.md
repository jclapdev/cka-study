# The practice cluster

Three Ubuntu 24.04 VMs run under [lima](https://lima-vm.io) on Apple's Virtualization framework.

| VM | Role | CPUs | Memory |
| --- | --- | --- | --- |
| `controlplane` | Control plane. Almost all work happens here. | 2 | 4 GiB |
| `node01` | Worker | 2 | 2 GiB |
| `node02` | Worker | 2 | 2 GiB |

The VMs share lima's `user-v2` network, `192.168.104.0/24`, which is the network mode where VMs can reach each other. Each VM has passwordless `sudo`.

`lab/provision.sh` installs containerd, kubelet, kubeadm and kubectl at Kubernetes 1.34, turns swap off and sets the kernel settings kubeadm checks for. It does not create a cluster. The exam runs 1.35, so the version is one behind on purpose: the cluster-upgrade lab upgrades to exactly the exam's version.

## Commands

Run these from the repo root on the Mac.

| Command | What it does |
| --- | --- |
| `lab/provision.sh` | Creates the VMs and installs the prerequisites. Safe to re-run; it skips what exists. |
| `lab/provision.sh --auto` | Does the same, then builds the cluster with kubeadm and Flannel. Use it when a lesson needs a working cluster and you have not built one. |
| `limactl start controlplane && limactl start node01 && limactl start node02` | Starts the VMs. |
| `limactl shell controlplane` | Opens a shell on a VM. `exit` returns to the Mac. |
| `lab/snapshot.sh save <tag>` | Copies all three VM disks under a name, then restarts the VMs. |
| `lab/snapshot.sh restore <tag>` | Puts all three VMs back to that copy and leaves them stopped. |
| `lab/snapshot.sh list` | Lists saved snapshots. |

Save and restore copy three disk images and take a few minutes each.

Saving over a tag replaces it.

## The labs

Each exercise README names the lab it starts from. A lab is a saved snapshot of the three VMs.

| Lab | Snapshot tag | What it contains | Made by |
| --- | --- | --- | --- |
| `vms` | `clean` | Three bare VMs with the prerequisites installed and no cluster. | `lab/snapshot.sh save clean` right after `lab/provision.sh`. |
| `cluster` | `built` | A working three-node kubeadm cluster with Flannel and labelled workers. | The Clean up step of [00-kubeadm-install](../01-cluster-architecture/00-kubeadm-install/README.md), or `lab/provision.sh --auto` then `lab/snapshot.sh save built`. |

Saving over `clean` leaves no way back to bare VMs short of deleting the VMs and running `lab/provision.sh` again.

An exercise that needs more than a restore, such as an add-on installed or a component broken on purpose, carries a `setup.sh` in its own folder that restores the lab and then makes its changes.

## Problems specific to this lab

**The wrong IP address.** Each VM has two addresses. The one on `192.168.104.0/24` reaches the other VMs. The other is a private address lima uses to talk to the VM, and it reaches nothing else, although it looks just as valid in `ip addr`. Get the right one with:

```shell
ip route get 1.1.1.1 | awk '{print $7; exit}'
```

**`kubeadm join` times out.** The worker cannot reach the control plane on port 6443. It almost always means `kubeadm init` was given the private address instead of the `192.168.104.x` one. The address is baked into the cluster's certificates, so the fix is `sudo kubeadm reset -f` on every node and a new `kubeadm init` on `controlplane`.

**VMs cannot reach each other at all.** The VMs were created with a lima network mode other than `user-v2`. The `vzNAT` mode gives each VM its own private network, so the Mac reaches every VM but no VM reaches another. `lab/node.yaml` sets `user-v2`; recreate the VMs from it.
