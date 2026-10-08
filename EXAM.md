# About the CKA

## Format

- 15 to 20 hands-on tasks in 2 hours, in a remote desktop with a terminal and a browser.
- The pass mark is 66%. Each task shows its weight as a percentage.
- The clusters run Kubernetes 1.35.
- You start on a machine named `base`. Each task starts with a box naming the host to `ssh` into. `sudo -i` gives root, and `exit` returns to `base`. Doing a task on the wrong host scores zero for it, and ssh from one task host to another is not supported.
- `kubectl` is preinstalled with the `k` alias and bash completion on the hosts you `ssh` into, and `yq`, `curl` and `wget` are available there. `base` has none of them.
- The documentation allowed is [kubernetes.io/docs](https://kubernetes.io/docs), [kubernetes.io/blog](https://kubernetes.io/blog), [helm.sh/docs](https://helm.sh/docs), the [Gateway API docs](https://gateway-api.sigs.k8s.io), and any page a task links in its [Quick Reference](references/kubectl.md#snippets-from-the-docs) box ([resources allowed](https://docs.linuxfoundation.org/tc-docs/certification/certification-resources-allowed)).
- Grading checks the final state of the cluster only. How you got there is never inspected, so an [imperative](references/kubectl.md#generating-yaml) `kubectl create` scores the same as hand-written YAML.
- Tasks often combine topics, such as installing a [Helm](references/helm.md) [chart](references/helm.md#charts-repositories-and-releases) that brings a custom resource, or moving an Ingress to the Gateway API. An Ingress is a set of rules that routes outside HTTP traffic to [Services](references/services.md), and the Gateway API is the newer set of objects for the same job.

Registration includes two sessions of the [killer.sh](https://killer.sh) simulator, 17 tasks each, in the same remote desktop as the exam.

Sources: [Linux Foundation tips for the CKA](https://docs.linuxfoundation.org/tc-docs/certification/tips-cka-and-ckad), [CKA curriculum](https://github.com/cncf/curriculum).

## Exam environment

The remote desktop is XFCE with a terminal and Firefox, and nothing else is on screen.

- **Copy and paste.** The terminal copies with Ctrl+Shift+C and pastes with Ctrl+Shift+V, or with its right-click menu. Firefox uses Ctrl+C and Ctrl+V.
- **vim.** The INSERT key is blocked, so enter insert mode with `i`. Pasted YAML can come out re-indented, one step further right per line. Run `:set paste` before pasting to prevent it.
- **Nothing carries over between tasks.** Each task starts a new `ssh` session, so an alias, an exported variable or a `.vimrc` set in one task is gone in the next. Only what the hosts come with, `k` and its completion, is always there.
- **Docs search.** The search box on kubernetes.io is allowed, but opening a result outside the allowed sites is not. The [Kustomize](references/kustomize.md) field reference at `kubectl.docs.kubernetes.io` is not on the allowed list.
- **Partial credit.** A task is split into sub-tasks, and each one that is right in the final state scores. Harder sub-tasks can count for more. A task finished halfway still earns part of its weight.

YAML comes from three places, fastest first.

1. An imperative command that writes it: `k create deployment web --image=nginx --dry-run=client -o yaml > web.yaml`. `k create`, `k run` and `k expose` cover [Deployments](references/workloads.md), [Pods](references/pod.md), Services, [ConfigMaps](references/config.md), [Secrets](references/config.md#secrets), [Namespaces](references/namespaces.md), [ServiceAccounts](references/service-accounts.md), [Roles](references/rbac.md#the-model), bindings, [Jobs](references/workloads.md#other-workload-kinds) and CronJobs.
2. A snippet from a kubernetes.io page, found with the search box. Many pages have an example file with a copy button, or a ready-to-paste `cat <<EOF` block. Paste it, then change the names and values.
3. `k explain <kind>.<field>`, when you know a field exists but not where it goes. `--recursive` prints the whole tree.

The [kubectl](references/kubectl.md) page has the commands, and [Working with kubectl](00-exam-skills/00-exam-workflow/README.md) practises them.

Sources: [Linux Foundation tips for the CKA](https://docs.linuxfoundation.org/tc-docs/certification/tips-cka-and-ckad), [resources allowed](https://docs.linuxfoundation.org/tc-docs/certification/certification-resources-allowed), [killer.sh FAQ](https://killer.sh/faq) (partial credit), [a 2026 candidate's guide](https://github.com/techwithmohamed/CKA-Certified-Kubernetes-Administrator) (a new ssh session per task).

## Domains

### Troubleshooting (30%)

- Troubleshoot clusters and nodes.
- Troubleshoot cluster components.
- Monitor cluster and application resource usage.
- Manage and evaluate container output streams.
- Troubleshoot services and networking.

### Cluster Architecture, Installation and Configuration (25%)

- Manage role-based access control ([RBAC](references/rbac.md)).
- Prepare underlying infrastructure for installing a Kubernetes cluster.
- Create and manage Kubernetes clusters using [kubeadm](references/kubeadm.md).
- Manage the lifecycle of Kubernetes clusters.
- Implement and configure a highly available [control plane](references/control-plane.md).
- Use Helm and Kustomize to install cluster components.
- Understand extension interfaces ([CNI](references/pod-network.md), CSI, [CRI](references/workers.md#what-a-worker-runs)). CSI (Container Storage Interface) is the standard for storage plugins, as CNI is for network plugins.
- Understand [CRDs](references/crds.md), and install and configure [operators](references/crds.md#operators).

### Services and Networking (20%)

- Understand connectivity between Pods.
- Define and enforce Network Policies.
- Use [ClusterIP](references/services.md#service-types), NodePort and LoadBalancer service types and endpoints.
- Use the Gateway API to manage Ingress traffic.
- Know how to use Ingress [controllers](references/control-plane.md#components) and Ingress resources.
- Understand and use [CoreDNS](references/pod-network.md#coredns).

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
