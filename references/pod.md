# Pod

The smallest thing Kubernetes schedules. One or more containers that share a network namespace (same IP, same localhost, same port space) and can share volumes. Containers are never scheduled individually.

A pod is bound to one node for life. It is never moved — a "moved" pod is a new pod created by a controller (Deployment, DaemonSet, StatefulSet) after the old one died.

## Phases

`kubectl get pods` STATUS mixes the pod phase with container-level reasons.

| Shown | Meaning |
| --- | --- |
| `Pending` | Accepted, not running yet: unscheduled, or image still pulling |
| `Running` | Bound to a node, at least one container started |
| `Succeeded` / `Failed` | All containers terminated, zero / non-zero exit |
| `ContainerCreating` | Scheduled; runtime and CNI are setting the pod up |
| `CrashLoopBackOff` | Container keeps exiting; kubelet restarts with growing delay |
| `ImagePullBackOff` | Image cannot be pulled — wrong name, or no registry access |
| `Error` | Container exited non-zero and is not being restarted |

`Pending` and `CrashLoopBackOff` fail in different places, so they need different questions:

```bash
kubectl describe pod <name> -n <ns>       # Events at the bottom: scheduling, pulls, mounts
kubectl logs <name> -n <ns>               # what the process said
kubectl logs <name> -n <ns> --previous    # what the crashed instance said
kubectl get events -n <ns> --sort-by=.lastTimestamp
```

`Pending` with "no nodes available" is a scheduling problem (taints, resources, selectors). `CrashLoopBackOff` is the container's own fault and lives in the logs.

## Relevance to a fresh cluster

CoreDNS pods sit in `Pending` from `kubeadm init` until a CNI exists — they need a pod IP and nothing can allocate one. Two CoreDNS pods `Running` is therefore the honest signal that the [pod network](pod-network.md) works, better than the node's `Ready` condition alone.

Control plane components are pods too, but [static ones](control-plane.md).

## Docs

- [Pods](https://kubernetes.io/docs/concepts/workloads/pods/)
- [Pod lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/)
- [DaemonSet](https://kubernetes.io/docs/concepts/workloads/controllers/daemonset/)
- [Taints and tolerations](https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/)

Related: [control-plane](control-plane.md), [pod-network](pod-network.md).
