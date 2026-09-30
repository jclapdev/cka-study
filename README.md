# CKA practice labs

Hands-on labs for the Certified Kubernetes Administrator (CKA) exam. Each topic has step-by-step exercises, a quiz, and a timed practice exam in the real exam's format.

## Getting started

1. Install [Docker Desktop](https://docs.docker.com/desktop/) on Windows or macOS, or [Docker Engine](https://docs.docker.com/engine/install/) on Linux, and start it.
2. In a terminal, inside this project's folder, start the app:

   ```shell
   docker compose up -d
   ```

3. Open <http://localhost:5173> and open a topic.
4. On the topic's **Lab** tab, press **Start lab**. The first time takes about 6 minutes, because it builds the lab. After that it takes under a minute.
5. Press **Open terminal**. You start on `base`, as in the exam. Run `ssh controlplane` to reach the cluster.

## App

Each topic page has three tabs: **Lab**, **Exercise** and **References**. **Open terminal** opens a shell on `base` beside the page. Copy with Ctrl+Shift+C and paste with Ctrl+Shift+V, the same keys as the exam terminal.

Your progress is saved in `app/data/progress.db`. Delete it to start over. `docker compose --profile lab down` stops the app and the lab, and `docker compose up -d` starts the app again.

## How the exam asks questions

The Practice sections match the real exam:

- 15 to 20 hands-on tasks in 2 hours, on Kubernetes 1.35, with a 66% pass mark.
- Each task names the host to `ssh` into and shows its weight as a percentage.
- Only the final state of the cluster is graded, so the fastest correct method wins.
- The documentation allowed is [kubernetes.io/docs](https://kubernetes.io/docs), [kubernetes.io/blog](https://kubernetes.io/blog), [helm.sh/docs](https://helm.sh/docs), the [Gateway API docs](https://gateway-api.sigs.k8s.io), and any page a task links in its Quick Reference box ([resources allowed](https://docs.linuxfoundation.org/tc-docs/certification/certification-resources-allowed)).

[EXAM.md](EXAM.md) has the full format and every competency the topics below map to.

## Exercises

Status is **ready** when a topic has steps and a Practice section, **steps only** when it has no Practice section yet, and blank when it is coming soon.

| Domain | Topic | Status |
| --- | --- | --- |
| 00-exam-skills | [00-exam-workflow](00-exam-skills/00-exam-workflow/README.md) | ready |
| 01-cluster-architecture (25%) | [00-kubeadm-install](01-cluster-architecture/00-kubeadm-install/README.md) | ready |
| | [01-rbac](01-cluster-architecture/01-rbac/README.md) | ready |
| | [02-helm](01-cluster-architecture/02-helm/README.md) | ready |
| | [03-kustomize](01-cluster-architecture/03-kustomize/README.md) | ready |
| | [04-crds-operators](01-cluster-architecture/04-crds-operators/README.md) | ready |
| | 05-extension-interfaces | |
| | 06-etcd-backup-restore | |
| | 07-cluster-upgrade | |
| | 08-ha-control-plane | |
| 02-workloads-scheduling (15%) | 00-deployments-rollout-rollback | |
| | 01-configmaps-secrets | |
| | 02-self-healing | |
| | 03-autoscaling | |
| | 04-scheduling-admission | |
| 03-services-networking (20%) | 00-pod-connectivity | |
| | 01-services-endpoints | |
| | 02-network-policies | |
| | 03-ingress | |
| | 04-gateway-api | |
| | 05-coredns | |
| 04-storage (10%) | 00-volume-types-access-modes-reclaim | |
| | 01-pv-pvc-lifecycle | |
| | 02-storageclasses-dynamic-provisioning | |
| 05-troubleshooting (30%) | 00-cluster-and-nodes | |
| | 01-control-plane-components | |
| | 02-resource-monitoring | |
| | 03-container-output-streams | |
| | 04-services-networking-debug | |
| 99-mock-exams | Full sets of 15 to 20 mixed tasks in 2 hours. | |

[references/](references/README.md) holds one-page concept summaries that the exercises link to.
