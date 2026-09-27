# References

Concept summaries shared by every exercise. Each one states the model, how it shows up in this lab, its failure modes, and links to the official docs.

| File | Covers |
| --- | --- |
| [control-plane](control-plane.md) | apiserver, etcd, controller-manager, scheduler, static pods, the control plane taint |
| [workers](workers.md) | kubelet, containerd/CRI, joining, node conditions, role labels |
| [pod](pod.md) | pods, phases, reading `Pending` vs `CrashLoopBackOff` |
| [pod-network](pod-network.md) | pod/service/node CIDRs, CNI plugins, CoreDNS |
| [kubeconfig](kubeconfig.md) | clusters/users/contexts, resolution order, kubeadm's kubeconfigs |
| [rbac](rbac.md) | Roles vs ClusterRoles, the two bindings, subjects, `auth can-i` |

Every new exercise extends this folder: each concept it touches either already has a summary here or gets one written alongside it, and the exercise README links to them.
