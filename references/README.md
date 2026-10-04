# References

One-page summaries of the concepts the exercises use.

| File | Covers |
| --- | --- |
| [exam-workflow](exam-workflow.md) | hosts and ssh, `k` and short names, generating YAML, docs snippets, vim for YAML, `explain`, changing and checking live objects |
| [kubeadm](kubeadm.md) | what `init` does phase by phase, the advertise address, tokens, `reset`, preflight failures |
| [control-plane](control-plane.md) | apiserver, etcd, controller-manager, scheduler, static pods, the control plane taint |
| [workers](workers.md) | kubelet, containerd/CRI, the kubelet before a cluster exists, joining, node conditions, role labels |
| [pod](pod.md) | pods, phases, reading `Pending` vs `CrashLoopBackOff` |
| [pod-network](pod-network.md) | pod/service/node CIDRs, CNI plugins, host-network pods, CoreDNS |
| [daemonsets](daemonsets.md) | one pod per node, kube-proxy and the CNI agent, taints |
| [labels](labels.md) | keys and values, adding and removing, selectors, node role labels |
| [kubeconfig](kubeconfig.md) | clusters/users/contexts, resolution order, kubeadm's kubeconfigs |
| [rbac](rbac.md) | Roles vs ClusterRoles, the two bindings, subjects, `auth can-i`, the roles every subject gets |
| [namespaces](namespaces.md) | namespaces, namespaced vs cluster-scoped resources, `api-resources` |
| [api-groups](api-groups.md) | the core group, named groups, `apiVersion`, groups in RBAC rules |
| [service-accounts](service-accounts.md) | ServiceAccounts, their full names and groups, tokens in pods |
| [authentication](authentication.md) | users and groups from certificates, `admin.conf` vs `super-admin.conf`, `auth whoami`, `--as` |
| [helm](helm.md) | charts, repositories and releases, values and `--reuse-values`, revisions and rollback, where releases are stored, `helm template` |
| [kustomize](kustomize.md) | bases and overlays, the fields an overlay sets, `labels` and selectors, patches, generated ConfigMap names, `-k` vs `-f` |
| [crds](crds.md) | what a CRD adds, its parts, schema validation, operators and reconciling, CRDs in Helm charts |
