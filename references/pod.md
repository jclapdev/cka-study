# Pod

A pod is the smallest thing Kubernetes schedules: one or more containers that share a [network namespace](pod-network.md#network-namespaces-on-a-node) (same IP, same localhost, same port space) and can share volumes. Containers are never scheduled individually.

A pod is bound to one node for life. It is never moved. A pod that seems to have moved is a new pod, created by a [controller](control-plane.md#components) such as a [Deployment](workloads.md) or a [DaemonSet](daemonsets.md) after the old one died.

## Phases

`kubectl get pods` STATUS mixes the [pod phase](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-phase) with container-level reasons.

| Shown | Meaning |
| --- | --- |
| `Pending` | Accepted, not running yet: unscheduled, or image still pulling |
| `Running` | Bound to a node, at least one container started |
| `Succeeded` / `Failed` | All containers terminated, zero / non-zero exit |
| `ContainerCreating` | Scheduled; the [container runtime](workers.md#worker-components) and the [CNI](pod-network.md) plugin, which gives the pod its network address, are setting it up |
| `CrashLoopBackOff` | The container keeps exiting, and the kubelet restarts it with a growing delay ([container restarts](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#container-restarts)) |
| `ImagePullBackOff` | Image cannot be pulled: a wrong name, or no access to the registry |
| `Error` | Container exited non-zero and is not being restarted |

These commands show why a pod fails ([debugging pods](https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/)):

```bash
kubectl describe pod <name> -n <ns>       # Events at the bottom: scheduling, pulls, mounts
kubectl logs <name> -n <ns>               # what the process said
kubectl logs <name> -n <ns> --previous    # what the crashed instance said
kubectl get events -n <ns> --sort-by=.lastTimestamp
```

`Pending` with `FailedScheduling` and `0/1 nodes are available` in the events is a scheduling problem: [taints](taints.md), resources or selectors. `CrashLoopBackOff` means the container's process keeps failing, and `kubectl logs` shows why.

## Pending CoreDNS pods

After `kubeadm init`, the two pods of [CoreDNS](pod-network.md#coredns), the cluster's DNS server, are `Pending`. The node is `NotReady` until a pod network is installed, so it carries the `node.kubernetes.io/not-ready:NoSchedule` taint, a mark that keeps off every pod without a matching toleration. CoreDNS has none for it. `kubectl describe pod` shows it in the events:

```
Warning  FailedScheduling  default-scheduler  0/1 nodes are available: 1 node(s) had untolerated taint(s).
```

Once the node is `Ready`, CoreDNS is scheduled and waits in `ContainerCreating` until the pod network gives it an address. Both CoreDNS pods `Running` shows that pods are getting addresses. The node being `Ready` does not.

Control plane components are pods too, but [static ones](control-plane.md).

## Docs

- [Pods](https://kubernetes.io/docs/concepts/workloads/pods/)
- [Pod lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/)
- [DaemonSet](https://kubernetes.io/docs/concepts/workloads/controllers/daemonset/)
- [Taints and tolerations](https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/)

Related: [Control plane](control-plane.md), [Pod network](pod-network.md).
