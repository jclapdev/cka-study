# Workers

A node is one machine in the cluster, and the [apiserver](control-plane.md#components) keeps a Node object for each. A worker is a node that runs workloads. It has the same software as the [control plane](control-plane.md) node: a [container runtime](#what-a-worker-runs), the kubelet, [kubeadm](kubeadm.md), swap turned off, and the same kernel settings ([installing kubeadm](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/install-kubeadm/)). The only difference is that it has no control plane [static pods](control-plane.md#static-pods).

## What a worker runs

- **kubelet**, a systemd service. It is the only agent that starts containers. It registers the node, watches the apiserver for pods assigned to it, and reports their status.
- **The container runtime** is the program that pulls images and starts and stops containers. containerd is one such runtime. The CRI (container runtime interface) is the API the kubelet uses to give a runtime instructions, and containerd serves it at `/run/containerd/containerd.sock`. crictl is a command-line client for the CRI ([`crictl`](https://kubernetes.io/docs/tasks/debug/debug-cluster/crictl/)), so `sudo crictl ps` lists the node's containers.
- **kube-proxy** and the pod network agent, both as [DaemonSet](daemonsets.md) pods.

A worker has no admin [kubeconfig](kubeconfig.md), only `/etc/kubernetes/kubelet.conf` for the kubelet's own identity. `kubectl` on a worker fails with `The connection to the server localhost:8080 was refused`. Run `kubectl` on the control plane node.

## The kubelet before `init` or `join`

The kubelet is installed and enabled before the machine is part of a cluster. With no configuration file it exits at once, and systemd restarts it every 10 seconds:

```
Active: activating (auto-restart) (Result: exit-code)
```

`sudo journalctl -u kubelet` shows why:

```
"command failed" err="failed to load kubelet config file, path: /var/lib/kubelet/config.yaml, error: … open /var/lib/kubelet/config.yaml: no such file or directory"
```

`kubeadm init` or `kubeadm join` writes that file, and the kubelet then stays up.

## Joining

`kubeadm join <apiserver>:6443 --token <token> --discovery-token-ca-cert-hash sha256:<hash>`

At the start neither side trusts the other, so the join line carries one secret in each direction. The [CA](certificates.md) hash lets the node check that it reached the right apiserver. The token lets the apiserver accept the node for long enough to sign a client certificate for it ([TLS bootstrapping](https://kubernetes.io/docs/reference/access-authn-authz/kubelet-tls-bootstrapping/)). After the join, the node authenticates with that certificate, which lands in `/var/lib/kubelet/pki/kubelet-client-current.pem`. [Joining a node](../learn/kubeadm.md#joining-a-node) shows the sequence.

Tokens expire 24 hours after they are created ([bootstrap tokens](https://kubernetes.io/docs/reference/access-authn-authz/bootstrap-tokens/)), so the join line printed by `kubeadm init` stops working after a day. Print a new one on the control plane node:

```bash
sudo kubeadm token create --print-join-command
```

`join` fails when the worker cannot reach the apiserver's advertise address on 6443, or when the node has state left from an earlier join (`sudo kubeadm reset -f` clears it). [kubeadm's failure modes](kubeadm.md#failure-modes) list the errors.

## Node conditions

`Ready` is one of several [conditions](https://kubernetes.io/docs/reference/node/node-status/#condition). `kubectl describe node` followed by a node's name shows them all, plus allocatable resources and the pods placed there.

| Condition | What it means |
| --- | --- |
| `Ready=False` | The kubelet is unhealthy, or the node has no pod network configuration. |
| `Ready=Unknown` | The kubelet stopped reporting, because the node or the kubelet is down. |
| `MemoryPressure`, `DiskPressure`, `PIDPressure` | The node is running out of that resource, and the kubelet starts [evicting pods](https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/). |

When a node goes `NotReady` or unreachable, its pods are evicted after 300 seconds, because every pod tolerates the not-ready and unreachable [taints](taints.md) for that long by default ([taint-based evictions](https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/#taint-based-evictions)). The evicted pods are recreated on other nodes by their controllers.

## Roles

A node has no role field. The ROLES column is built from [labels](labels.md) named [`node-role.kubernetes.io/<role>`](https://kubernetes.io/docs/reference/labels-annotations-taints/#node-role-kubernetes-io), which by convention have an empty value:

```bash
kubectl label node node01 node02 node-role.kubernetes.io/worker=
```

kubeadm labels the control plane node with `node-role.kubernetes.io/control-plane=` and taints it to match. It gives the workers no role label.

## Docs

- [Nodes](https://kubernetes.io/docs/concepts/architecture/nodes/)
- [kubeadm join](https://kubernetes.io/docs/reference/setup-tools/kubeadm/kubeadm-join/) · [kubeadm token](https://kubernetes.io/docs/reference/setup-tools/kubeadm/kubeadm-token/)
- [Bootstrap tokens](https://kubernetes.io/docs/reference/access-authn-authz/bootstrap-tokens/)
- [Container runtime interface](https://kubernetes.io/docs/concepts/architecture/cri/)
- [Installing kubeadm](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/install-kubeadm/)

Related: [kubeadm](kubeadm.md), [Control plane](control-plane.md), [Pod network](pod-network.md), [Pod](pod.md).
