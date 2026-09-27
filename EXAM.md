# The CKA exam

## Format

- 15 to 20 hands-on tasks in 2 hours, in a remote desktop with a terminal and a browser.
- The pass mark is 66%. Each task shows its weight as a percentage.
- The clusters run Kubernetes 1.35.
- Each task starts with a box naming the host to `ssh` into. `sudo -i` gives root, and `exit` returns to the base machine. Doing a task on the wrong host scores zero for it.
- `kubectl` is preinstalled with the `k` alias and bash completion. `yq`, `curl` and `wget` are available.
- The documentation allowed is [kubernetes.io/docs](https://kubernetes.io/docs), [kubernetes.io/blog](https://kubernetes.io/blog), [helm.sh/docs](https://helm.sh/docs), the [Gateway API docs](https://gateway-api.sigs.k8s.io), and any page a task links in its Quick Reference box ([resources allowed](https://docs.linuxfoundation.org/tc-docs/certification/certification-resources-allowed)).
- Grading checks the final state of the cluster only. How you got there is never inspected, so an imperative `kubectl create` scores the same as hand-written YAML, and speed decides the result.
- Tasks often combine topics, such as installing a Helm chart that brings a custom resource, or moving an Ingress to the Gateway API.

Registration includes two sessions of the [killer.sh](https://killer.sh) simulator, 17 tasks each, in the same remote desktop as the exam. Save them for the last two weeks.

Sources: [Linux Foundation tips for the CKA](https://docs.linuxfoundation.org/tc-docs/certification/tips-cka-and-ckad), [CKA curriculum](https://github.com/cncf/curriculum).

## Domains

### Troubleshooting (30%)

- Troubleshoot clusters and nodes.
- Troubleshoot cluster components.
- Monitor cluster and application resource usage.
- Manage and evaluate container output streams.
- Troubleshoot services and networking.

### Cluster Architecture, Installation and Configuration (25%)

- Manage role-based access control (RBAC).
- Prepare underlying infrastructure for installing a Kubernetes cluster.
- Create and manage Kubernetes clusters using kubeadm.
- Manage the lifecycle of Kubernetes clusters.
- Implement and configure a highly available control plane.
- Use Helm and Kustomize to install cluster components.
- Understand extension interfaces (CNI, CSI, CRI).
- Understand CRDs, and install and configure operators.

### Services and Networking (20%)

- Understand connectivity between Pods.
- Define and enforce Network Policies.
- Use ClusterIP, NodePort and LoadBalancer service types and endpoints.
- Use the Gateway API to manage Ingress traffic.
- Know how to use Ingress controllers and Ingress resources.
- Understand and use CoreDNS.

### Workloads and Scheduling (15%)

- Understand deployments and how to perform rolling updates and rollbacks.
- Use ConfigMaps and Secrets to configure applications.
- Configure workload autoscaling.
- Understand the primitives used to create robust, self-healing application deployments.
- Configure Pod admission and scheduling (limits, node affinity).

### Storage (10%)

- Implement storage classes and dynamic volume provisioning.
- Configure volume types, access modes and reclaim policies.
- Manage persistent volumes and persistent volume claims.
