# CKA practice labs

Hands-on labs for the Certified Kubernetes Administrator (CKA) exam. Each topic folder is one exercise with a single `README.md` that walks you through the concept step by step, then asks for the same result in exam wording so you can practise it unaided.

## Getting started

1. Set up the lab once, following [first-time setup](lab/README.md#first-time-setup). The lab is three virtual machines on your Mac where every exercise's commands run, and [lab/README.md](lab/README.md) explains all of it.
2. Start the study app, below, and pick an exercise.

Each exercise names the lab starting state it needs at the top and links to the commands that get you there. Everything else on the page is the lesson.

## Study app

`app/` is a local web page that shows each exercise with a tick on every step, Recall questions you grade yourself, a timed Practice it run with a score, and notes per topic. It reads the READMEs directly, so there is nothing to sync, and keeps your progress in `app/data/progress.db`. Commands still run in your own terminal.

It needs Node 24 and pnpm (`corepack enable pnpm`). In a terminal on your Mac:

```shell
cd ~/projects/cka-prep/app && pnpm install && pnpm dev
```

Then open <http://127.0.0.1:5173>. Delete `app/data/progress.db` to start over.

## How the exam asks questions

The "Practice it" sections are written to match the real exam:

- 15 to 20 hands-on tasks in 2 hours, on Kubernetes 1.35, with a 66% pass mark.
- Each task names the host to `ssh` into and shows its weight as a percentage.
- Only the final state of the cluster is graded, so the fastest correct method wins.
- The documentation allowed is [kubernetes.io/docs](https://kubernetes.io/docs), [kubernetes.io/blog](https://kubernetes.io/blog), [helm.sh/docs](https://helm.sh/docs), the [Gateway API docs](https://gateway-api.sigs.k8s.io), and any page a task links in its Quick Reference box ([resources allowed](https://docs.linuxfoundation.org/tc-docs/certification/certification-resources-allowed)).

[EXAM.md](EXAM.md) has the full format and every competency the topics below map to.

## Exercises

Status is **ready** when the README has steps and a Practice it section, **steps only** when it has no Practice it section yet, and blank when the folder is not written.

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
