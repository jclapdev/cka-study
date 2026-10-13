# Control plane

The control plane is the set of components that store the cluster's desired state and act to
make the nodes match it. Workloads run on nodes.

[Cluster architecture](../learn/cluster-architecture.md) explains how the parts fit together.

## Components

| Component | What it does | Where kubeadm puts it |
| --- | --- | --- |
| [`kube-apiserver`](https://kubernetes.io/docs/reference/command-line-tools-reference/kube-apiserver/) | The only door to cluster state. Everything else, from `kubectl` to [kubelets](workers.md#worker-components) and controllers, talks to it and never to etcd. Serves on port 6443. | [static pod](#static-pods) |
| [`etcd`](https://kubernetes.io/docs/tasks/administer-cluster/configure-upgrade-etcd/) | The key-value store that holds every object. | static pod |
| `kube-controller-manager` | One process running many [controllers](https://kubernetes.io/docs/concepts/architecture/controller/), such as the ones for node health, replica counts and [ServiceAccounts](service-accounts.md). | static pod |
| [`kube-scheduler`](https://kubernetes.io/docs/concepts/scheduling-eviction/kube-scheduler/) | Assigns unscheduled pods to nodes: it drops the nodes a pod cannot run on, then picks the best of the rest. It only writes `spec.nodeName`; the kubelet, the agent on each node, starts the pod. | static pod |

A controller is a loop that compares the state an object asks for with what exists, and acts on
the difference, such as creating a pod when a [Deployment](workloads.md) has too few.

The control plane node is also a node, so it runs the same two programs as every worker. The kubelet starts the node's pods. kube-proxy makes [Service](services.md) addresses work on the node. `kubectl get pods -n kube-system` shows the four components above
and kube-proxy. The kubelet is a systemd service, not a pod, so `systemctl status kubelet` and
`journalctl -u kubelet` show it instead.

## Static pods

A static pod is a pod defined by a file in `/etc/kubernetes/manifests/` rather than
by an API object. The kubelet watches that directory directly, so static pods start with no
apiserver and no scheduler involved ([static pods](../learn/cluster-architecture.md#static-pods)).
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
off it ([taints and tolerations](https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/)). The pod network's pods, installed through [CNI](pod-network.md) (Container Network Interface), and the kube-proxy pods must run on every node. They carry a toleration for the taint, an entry that lets a pod onto a tainted node, so they still land
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
