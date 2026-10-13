# Learn

Each page explains how a technology behind Kubernetes works: what it is for, how its parts fit together, and where to read more.

| Page | Covers |
| --- | --- |
| [kubectl and the API](kubectl.md) | kubeconfig, what happens to a request in the apiserver, API groups, imperative and declarative commands |
| [Cluster architecture](cluster-architecture.md) | desired state and controllers, the control plane and nodes, static pods, pods and their owners, Deployments, ReplicaSets and Services |
| [kubeadm basics](kubeadm.md) | what init builds and in what order, certificates, how a node joins, what kubeadm leaves out |
| [etcd basics](etcd.md) | what etcd holds, keys and watches, members, leaders and quorum, stacked and external etcd, what a backup covers |
| [TLS basics](tls.md) | key pairs, certificates and CAs, how a connection is checked, users from certificates, kubeadm's three CAs, expiry |
| [Cluster DNS](dns.md) | a pod's resolv.conf, search suffixes and ndots, Service records, CoreDNS and its Corefile |
| [Network namespaces](network-namespaces.md) | network namespaces, veth pairs, the bridge, routes between nodes, VXLAN |
| [Storage](storage.md) | the container's writable layer, volumes and how long each kind lasts, PersistentVolumes, claims, StorageClasses and CSI |
| [Pod networking](pod-network.md) | the network model, CNI plugins, the three address ranges, why nodes start NotReady |
| [Access control](access-control.md) | authentication and authorization, users without objects, ServiceAccounts, the RBAC model |
| [Helm basics](helm.md) | the problem Helm solves, what happens during an install, release history, Helm compared with Kustomize and operators |
| [Kustomize basics](kustomize.md) | bases and overlays, names that change with their contents, Kustomize compared with Helm |
| [Custom resources and operators](crds-operators.md) | what a CRD adds, operators and reconciling, what installing an operator means |
