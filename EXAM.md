# The CKA exam

## Format

- 15 to 20 hands-on tasks in 2 hours, in a remote desktop with a terminal and a browser.
- The pass mark is 66%. Each task shows its weight as a percentage.
- The clusters run Kubernetes 1.35.
- You start on a machine named `base`. Each task starts with a box naming the host to `ssh` into. `sudo -i` gives root, and `exit` returns to `base`. Doing a task on the wrong host scores zero for it, and ssh from one task host to another is not supported.
- `kubectl` is preinstalled with the `k` alias and bash completion on the hosts you `ssh` into, and `yq`, `curl` and `wget` are available there. `base` has none of them.
- The documentation allowed is [kubernetes.io/docs](https://kubernetes.io/docs), [kubernetes.io/blog](https://kubernetes.io/blog), [helm.sh/docs](https://helm.sh/docs), the [Gateway API docs](https://gateway-api.sigs.k8s.io), and any page a task links in its Quick Reference box ([resources allowed](https://docs.linuxfoundation.org/tc-docs/certification/certification-resources-allowed)).
- Grading checks the final state of the cluster only. How you got there is never inspected, so an imperative `kubectl create` scores the same as hand-written YAML, and speed decides the result.
- Tasks often combine topics, such as installing a Helm chart that brings a custom resource, or moving an Ingress to the Gateway API.

Registration includes two sessions of the [killer.sh](https://killer.sh) simulator, 17 tasks each, in the same remote desktop as the exam. Save them for the last two weeks.

Sources: [Linux Foundation tips for the CKA](https://docs.linuxfoundation.org/tc-docs/certification/tips-cka-and-ckad), [CKA curriculum](https://github.com/cncf/curriculum).

## How to work in the exam

The remote desktop is XFCE with a terminal and Firefox, and nothing else is on screen. These details change how fast you can go:

- **Copy and paste.** The terminal copies with Ctrl+Shift+C and pastes with Ctrl+Shift+V, or with its right-click menu. Firefox uses Ctrl+C and Ctrl+V.
- **vim.** The INSERT key is blocked, so enter insert mode with `i`. Pasted YAML can come out re-indented, one step further right per line. Run `:set paste` before pasting to prevent it.
- **Nothing carries over between tasks.** Each task starts a new `ssh` session, so an alias, an exported variable or a `.vimrc` set in one task is gone in the next. Only what the hosts come with, `k` and its completion, is always there.
- **Docs search.** The search box on kubernetes.io is allowed, but opening a result outside the allowed sites is not. The Kustomize field reference at `kubectl.docs.kubernetes.io` is not on the allowed list.
- **Partial credit.** A task is split into sub-tasks, and each one that is right in the final state scores. Harder sub-tasks can count for more. A task finished halfway still earns part of its weight.

YAML comes from three places, fastest first. Nobody types a whole manifest.

1. An imperative command that writes it: `k create deployment web --image=nginx --dry-run=client -o yaml > web.yaml`. `k create`, `k run` and `k expose` cover Deployments, Pods, Services, ConfigMaps, Secrets, Namespaces, ServiceAccounts, Roles, bindings, Jobs and CronJobs.
2. A snippet from a kubernetes.io page, found with the search box. Many pages have an example file with a copy button, or a ready-to-paste `cat <<EOF` block. Paste it, then change the names and values.
3. `k explain <kind>.<field>`, when you know a field exists but not where it goes. `--recursive` prints the whole tree.

The [exam workflow](references/exam-workflow.md) page has the commands, and the [exam workflow drill](00-exam-skills/00-exam-workflow/README.md) practises them.

Sources: [Linux Foundation tips for the CKA](https://docs.linuxfoundation.org/tc-docs/certification/tips-cka-and-ckad), [resources allowed](https://docs.linuxfoundation.org/tc-docs/certification/certification-resources-allowed), [killer.sh FAQ](https://killer.sh/faq) (partial credit), [a 2026 candidate's guide](https://github.com/techwithmohamed/CKA-Certified-Kubernetes-Administrator) (a new ssh session per task).

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
