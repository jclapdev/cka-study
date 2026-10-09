# Control plane

The control plane is the set of components that store the cluster's desired state and act to
make the nodes match it. Workloads run on nodes.

[How a cluster works](../learn/cluster-architecture.md) explains how the parts fit together.

## Components

| Component | What it does | Where kubeadm puts it |
| --- | --- | --- |
| [`kube-apiserver`](https://kubernetes.io/docs/reference/command-line-tools-reference/kube-apiserver/) | The only door to cluster state. Everything else — kubectl, kubelets, controllers — talks to it and never to etcd. Serves on 6443. | [static pod](#static-pods) |
| [`etcd`](https://kubernetes.io/docs/tasks/administer-cluster/configure-upgrade-etcd/) | Key-value store holding all cluster state. | static pod |
| `kube-controller-manager` | One process running many [controllers](https://kubernetes.io/docs/concepts/architecture/controller/), each a loop comparing desired to actual and acting on the gap (node health, replica counts, service accounts). | static pod |
| [`kube-scheduler`](https://kubernetes.io/docs/concepts/scheduling-eviction/kube-scheduler/) | Assigns unscheduled pods to nodes: it drops the nodes a pod cannot run on, then picks the best of the rest. Only writes `spec.nodeName`; the kubelet does the starting. | static pod |
| [`kubelet`](https://kubernetes.io/docs/reference/command-line-tools-reference/kubelet/) | On *every* node, control plane included. Starts containers, reports node and pod status. | systemd unit, not a pod |
| [`kube-proxy`](https://kubernetes.io/docs/reference/command-line-tools-reference/kube-proxy/) | On every node. Writes packet-forwarding rules (iptables or [IPVS](services.md#how-a-service-ip-answers)) so [Service](services.md) IPs work. | [DaemonSet](daemonsets.md) |

A controller is a loop that compares the state an object asks for with what exists, and acts on
the difference, such as creating a pod when a [Deployment](workloads.md) has too few.

`kubectl get pods -n kube-system` shows all of these except the kubelet, which
`systemctl status kubelet` and `journalctl -u kubelet` show.

## Static pods

A static pod is a pod defined by a file in `/etc/kubernetes/manifests/` rather than
by an API object. The kubelet watches that directory directly, so static pods start with no
apiserver and no scheduler involved ([how the control plane starts itself](../learn/cluster-architecture.md#how-the-control-plane-starts-itself)).
[Create static pods](https://kubernetes.io/docs/tasks/configure-pod-container/static-pod/) has the steps.

Because the kubelet reads the files directly:

- Editing a [manifest](kubectl.md#generating-yaml) file restarts that component within seconds. This is how a
  control plane component is reconfigured.
- Deleting a static pod with `kubectl delete pod` does nothing lasting.
  The scheduler's static pod is back `Running` within seconds of being deleted,
  because the kubelet recreates it from the file.
- The pod object the apiserver shows is a mirror of the file, and its owner is the
  [Node](workers.md), not a controller.
- Static pods are named `<manifest-name>-<node-name>`, such as `etcd-controlplane` for etcd on a node named `controlplane`.
- Anyone can list the directory, but the manifest files are root-only (mode `600`), so
  reading or editing one needs `sudo`.

## Control plane taint

`kubeadm init` [taints](taints.md) the control plane node
`node-role.kubernetes.io/control-plane:NoSchedule` so ordinary workloads stay
off it ([taints and tolerations](https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/)). [CNI](pod-network.md) and kube-proxy pods tolerate the taint, which is why they still land
there. Removing the taint is how a single-node cluster runs workloads:

```bash
kubectl taint node controlplane node-role.kubernetes.io/control-plane-      # trailing dash removes
```

## Docs

- [Cluster architecture](https://kubernetes.io/docs/concepts/architecture/)
- [Kubernetes components](https://kubernetes.io/docs/concepts/overview/components/)
- [Static pods](https://kubernetes.io/docs/tasks/configure-pod-container/static-pod/)
- [Control plane–node communication](https://kubernetes.io/docs/concepts/architecture/control-plane-node-communication/)
- [Ports and protocols](https://kubernetes.io/docs/reference/networking/ports-and-protocols/)
- [Operating etcd](https://kubernetes.io/docs/tasks/administer-cluster/configure-upgrade-etcd/)
- [kube-scheduler](https://kubernetes.io/docs/concepts/scheduling-eviction/kube-scheduler/)

Related: [kubeadm](kubeadm.md), [Pod](pod.md), [Workers](workers.md), [Pod network](pod-network.md),
[kubeconfig](kubeconfig.md).
