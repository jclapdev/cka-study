# Learn

How each technology in the exercises works: what it is for, how its parts fit together, and where to read more.

| File | Covers |
| --- | --- |
| [kubectl](kubectl.md) | kubeconfig, what happens to a request in the apiserver, API groups, imperative and declarative commands |
| [cluster-architecture](cluster-architecture.md) | desired state and controllers, the control plane and nodes, static pods, pods and their owners |
| [kubeadm](kubeadm.md) | what init builds and in what order, certificates, how a node joins, what kubeadm leaves out |
| [pod-network](pod-network.md) | the network model, CNI plugins, the three address ranges, why nodes start NotReady |
| [access-control](access-control.md) | authentication and authorization, users without objects, ServiceAccounts, the RBAC model |
| [helm](helm.md) | the problem Helm solves, what happens during an install, release history, Helm compared with Kustomize and operators |
| [kustomize](kustomize.md) | bases and overlays, names that change with their contents, Kustomize compared with Helm |
| [crds-operators](crds-operators.md) | what a CRD adds, operators and reconciling, what installing an operator means |
