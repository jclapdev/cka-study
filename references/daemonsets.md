# DaemonSets

A DaemonSet runs one copy of a pod on every node, or on every node that matches its selector. When a node joins, the DaemonSet adds a pod to it, and when a node leaves, its pod is removed ([DaemonSet](https://kubernetes.io/docs/concepts/workloads/controllers/daemonset/)). [Node](workers.md) agents are deployed this way: [kube-proxy](control-plane.md#components), the pod network's agent, log collectors.

## On a kubeadm cluster

A [kubeadm](kubeadm.md) cluster with [Flannel](pod-network.md#plugins) and two workers runs two DaemonSets:

```
NAMESPACE      NAME              DESIRED   CURRENT   READY   UP-TO-DATE   AVAILABLE   NODE SELECTOR            AGE
kube-flannel   kube-flannel-ds   3         3         2       3            2           <none>                   61s
kube-system    kube-proxy        3         3         3       3            3           kubernetes.io/os=linux   86s
```

`DESIRED` is the number of nodes that should run a copy. Each pod is named `<daemonset>-<random>`, such as `kube-proxy-4wdrl`, and `kubectl get pods -o wide` shows which node it runs on.

A DaemonSet's pods still obey [taints](taints.md) ([taints and tolerations](https://kubernetes.io/docs/concepts/workloads/controllers/daemonset/#taints-and-tolerations)). Both DaemonSets here tolerate every `NoSchedule` taint, so they also run on `controlplane`, which kubeadm taints `node-role.kubernetes.io/control-plane:NoSchedule` ([control-plane](control-plane.md)).

## Commands

```bash
kubectl get daemonsets -A
kubectl describe daemonset kube-proxy -n kube-system
kubectl rollout restart daemonset kube-proxy -n kube-system   # replace every pod
```

## Failure modes

| Symptom | Cause |
| --- | --- |
| `READY` is lower than `DESIRED` | A pod on some node is not ready. `kubectl get pods -o wide` finds the node, and the pod's logs say why. |
| `DESIRED` is lower than the number of nodes | The node selector does not match some nodes, or they have a taint the pods do not tolerate. |

## Docs

- [DaemonSet](https://kubernetes.io/docs/concepts/workloads/controllers/daemonset/)
- [Taints and tolerations](https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/)
