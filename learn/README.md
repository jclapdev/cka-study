# Learn

How each technology in the topics works: what it is for, how its parts fit together, and where to read more.

| Page | Covers |
| --- | --- |
| [How kubectl talks to the cluster](kubectl.md) | kubeconfig, what happens to a request in the apiserver, API groups, imperative and declarative commands |
| [How a Kubernetes cluster works](cluster-architecture.md) | desired state and controllers, the control plane and nodes, static pods, pods and their owners, Deployments, ReplicaSets and Services |
| [How kubeadm builds a cluster](kubeadm.md) | what init builds and in what order, certificates, how a node joins, what kubeadm leaves out |
| [How the pod network works](pod-network.md) | the network model, CNI plugins, the three address ranges, why nodes start NotReady |
| [How access control works](access-control.md) | authentication and authorization, users without objects, ServiceAccounts, the RBAC model |
| [How Helm works](helm.md) | the problem Helm solves, what happens during an install, release history, Helm compared with Kustomize and operators |
| [How Kustomize works](kustomize.md) | bases and overlays, names that change with their contents, Kustomize compared with Helm |
| [How CRDs and operators extend Kubernetes](crds-operators.md) | what a CRD adds, operators and reconciling, what installing an operator means |
