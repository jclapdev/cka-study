# Namespaces

A namespace is a named group of objects inside one cluster. Two objects of the same kind can share a name if they are in different namespaces, and a namespace is the boundary that a [Role](rbac.md#the-model) and a RoleBinding apply within. So do a ResourceQuota, which is a cap on the CPU, memory and number of objects a namespace may use, and a NetworkPolicy, which is a set of rules for which pods may talk to which ([namespaces](https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/)).

## Namespaced and cluster-scoped resources

Every resource type is one or the other, and the type decides it, not the object ([not all objects are in a namespace](https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/#not-all-objects-are-in-a-namespace)).

| | Examples | What `-n` does |
| --- | --- | --- |
| Namespaced | pods, deployments, secrets, configmaps, services, serviceaccounts, roles, rolebindings | picks which namespace to read or write |
| Cluster-scoped | nodes, persistentvolumes, namespaces, storageclasses, clusterroles, clusterrolebindings, customresourcedefinitions | nothing; the object has no namespace |

`kubectl api-resources` prints the `NAMESPACED` column for every type the cluster serves:

```bash
kubectl api-resources --namespaced=false
kubectl api-resources --namespaced=true
```

This matters for [RBAC](rbac.md). A RoleBinding grants access inside its own namespace, so it can never reach a cluster-scoped resource. Access to nodes or PersistentVolumes, which are pieces of storage that belong to the whole cluster, needs a ClusterRoleBinding.

## In this lab

A new [kubeadm](kubeadm.md) cluster starts with four namespaces ([initial namespaces](https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/#initial-namespaces)), and [Flannel](pod-network.md#plugins) adds a fifth:

| Namespace | Holds |
| --- | --- |
| `default` | Anything created without `-n`. |
| `kube-system` | The [control plane](control-plane.md) pods, [CoreDNS](pod-network.md#coredns) and [kube-proxy](control-plane.md#components). |
| `kube-public` | The `cluster-info` [ConfigMap](config.md). kubeadm binds a Role that lets `system:anonymous` read it, so a joining node can read it before it has credentials. |
| `kube-node-lease` | One Lease per node. A Lease is a small object with a timestamp, and the kubelet renews its node's every few seconds as a heartbeat. |
| `kube-flannel` | The Flannel pod network. |

In the lab, Kubernetes 1.34 serves 32 cluster-scoped and 33 namespaced resource types.

Each new namespace gets a ServiceAccount called `default` straight away. See [service-accounts](service-accounts.md).

## Commands

```bash
kubectl create namespace dev
kubectl get pods -n dev
kubectl get pods -A                                   # every namespace
kubectl config set-context --current --namespace=dev  # make dev the default for this context
```

## Failure modes

| Symptom | Cause |
| --- | --- |
| `No resources found in default namespace.` | The objects are in another namespace. Add `-n <ns>` or `-A`. |
| `kubectl auth can-i` prints `Warning: resource 'nodes' is not namespace scoped` | The question is about a cluster-scoped type, so any namespace in it, or in a RoleBinding for it, has no effect. |
## Docs

- [Namespaces](https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/)
- [Share a cluster with namespaces](https://kubernetes.io/docs/tasks/administer-cluster/namespaces/)
- [`kubectl api-resources`](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_api-resources/)
