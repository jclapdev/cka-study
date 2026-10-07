# CKA practice labs

Hands-on labs for the Certified Kubernetes Administrator (CKA) exam. Each topic has step-by-step exercises, a quiz, and a timed practice exam in the real exam's format.

## Getting started

With Docker running, run `docker compose up -d` in this folder and open <http://localhost:5173>. [Getting started](lab/README.md) has the requirements, setup and troubleshooting.

## How the exam asks questions

The Practice sections match the real exam:

- 15 to 20 hands-on tasks in 2 hours, on Kubernetes 1.35, with a 66% pass mark.
- Each task names the host to `ssh` into and shows its weight as a percentage.
- Only the final state of the cluster is graded, so the fastest correct method wins.
- The documentation allowed is [kubernetes.io/docs](https://kubernetes.io/docs), [kubernetes.io/blog](https://kubernetes.io/blog), [helm.sh/docs](https://helm.sh/docs), the [Gateway API docs](https://gateway-api.sigs.k8s.io), and any page a task links in its [Quick Reference](references/exam-workflow.md#snippets-from-the-docs) box ([resources allowed](https://docs.linuxfoundation.org/tc-docs/certification/certification-resources-allowed)).

[EXAM.md](EXAM.md) has the full format and every competency the topics below map to.

## Exercises

| Domain | Topic | Status |
| --- | --- | --- |
| kubectl Essentials | [Working with kubectl](00-exam-skills/00-exam-workflow/README.md) | ready |
| Cluster Architecture (25%) | [kubeadm Installation](01-cluster-architecture/00-kubeadm-install/README.md) | ready |
| | [RBAC](01-cluster-architecture/01-rbac/README.md) | ready |
| | [Helm](01-cluster-architecture/02-helm/README.md) | ready |
| | [Kustomize](01-cluster-architecture/03-kustomize/README.md) | ready |
| | [CRDs and Operators](01-cluster-architecture/04-crds-operators/README.md) | ready |
| | [CNI, CSI and CRI](01-cluster-architecture/05-extension-interfaces) | |
| | [etcd Backup and Restore](01-cluster-architecture/06-etcd-backup-restore) | |
| | [Cluster Upgrade](01-cluster-architecture/07-cluster-upgrade) | |
| | [High Availability](01-cluster-architecture/08-ha-control-plane) | |
| Workloads and Scheduling (15%) | [Rollouts and Rollbacks](02-workloads-scheduling/00-deployments-rollout-rollback) | |
| | [ConfigMaps and Secrets](02-workloads-scheduling/01-configmaps-secrets) | |
| | [Self-Healing](02-workloads-scheduling/02-self-healing) | |
| | [Autoscaling](02-workloads-scheduling/03-autoscaling) | |
| | [Scheduling](02-workloads-scheduling/04-scheduling-admission) | |
| Services and Networking (20%) | [Pod Networking](03-services-networking/00-pod-connectivity) | |
| | [Services](03-services-networking/01-services-endpoints) | |
| | [Network Policies](03-services-networking/02-network-policies) | |
| | [Ingress](03-services-networking/03-ingress) | |
| | [Gateway API](03-services-networking/04-gateway-api) | |
| | [CoreDNS](03-services-networking/05-coredns) | |
| Storage (10%) | [Volumes and Access Modes](04-storage/00-volume-types-access-modes-reclaim) | |
| | [Persistent Volumes](04-storage/01-pv-pvc-lifecycle) | |
| | [StorageClasses](04-storage/02-storageclasses-dynamic-provisioning) | |
| Troubleshooting (30%) | [Node Troubleshooting](05-troubleshooting/00-cluster-and-nodes) | |
| | [Control Plane Troubleshooting](05-troubleshooting/01-control-plane-components) | |
| | [Resource Monitoring](05-troubleshooting/02-resource-monitoring) | |
| | [Container Logs](05-troubleshooting/03-container-output-streams) | |
| | [Network Troubleshooting](05-troubleshooting/04-services-networking-debug) | |
| Mock Exams | Full sets of 15 to 20 mixed tasks in 2 hours. | |

[learn/](learn/README.md) explains how each technology works, with diagrams and further reading. [references/](references/README.md) holds the facts, commands and errors to look up.
