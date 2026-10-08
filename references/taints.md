# Taints and tolerations

A taint is a mark on a node that keeps pods off it. A toleration is a matching entry in a pod's spec that lets that pod onto a tainted node anyway. A toleration only permits a node. It doesn't send the pod there, which is what a node selector does ([taints and tolerations](https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/)).

A taint has a key, an optional value and an effect, written `key=value:Effect`, such as `disk=slow:NoSchedule`. The effect is what the taint does ([effects](#effects)). A toleration matches it when the key, the value (or `operator: Exists` for any value) and the effect agree.

## Effects

| Effect | New pods without a toleration | [Pods](pod.md) already running there |
| --- | --- | --- |
| NoSchedule | are not scheduled on the node | stay |
| PreferNoSchedule | are scheduled there only when no other node fits | stay |
| NoExecute | are not scheduled on the node | are evicted, after `tolerationSeconds` if the toleration sets one |

## Taints Kubernetes adds itself

| Taint | Added when |
| --- | --- |
| `node-role.kubernetes.io/control-plane:NoSchedule` | `kubeadm init` sets up the control plane node ([control plane taint](control-plane.md#control-plane-taint)) |
| `node.kubernetes.io/not-ready:NoSchedule` and `:NoExecute` | the node's `Ready` condition is `False`, such as before a pod network exists ([node conditions](workers.md#node-conditions)) |
| `node.kubernetes.io/unreachable:NoExecute` | the node stops reporting to the [apiserver](control-plane.md#components) |

The node controller adds and removes these from the node's conditions ([taint nodes by condition](https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/#taint-nodes-by-condition)). Every pod gets tolerations for `not-ready` and `unreachable` with `tolerationSeconds: 300`, so its pods are evicted from a lost node after 5 minutes ([taint-based evictions](https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/#taint-based-evictions)).

## On a kubeadm cluster

Only `controlplane` is tainted, so ordinary pods run on `node01` and `node02`:

```
NAME           TAINTS
controlplane   [map[effect:NoSchedule key:node-role.kubernetes.io/control-plane]]
node01         <none>
node02         <none>
```

The [CoreDNS](pod-network.md#coredns) pods tolerate the control plane taint, so they may run on `controlplane`:

```
[{"key":"CriticalAddonsOnly","operator":"Exists"},
 {"effect":"NoSchedule","key":"node-role.kubernetes.io/control-plane"},
 {"effect":"NoExecute","key":"node.kubernetes.io/not-ready","operator":"Exists","tolerationSeconds":300},
 {"effect":"NoExecute","key":"node.kubernetes.io/unreachable","operator":"Exists","tolerationSeconds":300}]
```

A [Deployment](workloads.md) with 2 pods on each worker, after `node02` is tainted `disk=slow:NoSchedule` and the Deployment is scaled to 8, has all 4 new pods on `node01`. The 2 pods already on `node02` stay:

```
      6 node01
      2 node02
```

## Commands

```bash
kubectl describe node controlplane | grep Taints
kubectl taint node node02 disk=slow:NoSchedule      # add
kubectl taint node node02 disk=slow:NoSchedule-     # remove: the same taint followed by -
kubectl explain pod.spec.tolerations
```

## Failure modes

| Symptom | Cause |
| --- | --- |
| A pod stays `Pending` with `0/3 nodes are available: 1 node(s) had untolerated taint(s), 2 node(s) didn't match Pod's node affinity/selector.` | The only node the pod may use is tainted, and the pod has no toleration for it. Here the pod's node selector picked `controlplane`. |
| Pods leave a node by themselves | The node has a `NoExecute` taint, often `unreachable` because it stopped reporting. |

## Docs

- [Taints and tolerations](https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/)
- [Well-known labels, annotations and taints](https://kubernetes.io/docs/reference/labels-annotations-taints/)
- [`kubectl taint`](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_taint/)
