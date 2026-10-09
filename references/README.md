# References

The facts, commands and errors for each concept the topics use.

| Page | Covers |
| --- | --- |
| [kubectl](kubectl.md) | hosts and ssh, `k` and short names, generating YAML, the four fields of a manifest, create and apply, docs snippets, vim for YAML, `explain`, changing and checking live objects |
| [kubeadm](kubeadm.md) | what `init` does phase by phase, the advertise address, tokens, `reset`, preflight failures |
| [Control plane](control-plane.md) | apiserver, etcd, controller-manager, scheduler, static pods, the control plane taint |
| [Workers](workers.md) | kubelet, containerd/CRI, the kubelet before a cluster exists, joining, node conditions, role labels |
| [Pod](pod.md) | pods, phases, reading `Pending` vs `CrashLoopBackOff` |
| [Pod network](pod-network.md) | pod/service/node CIDRs, CNI plugins, host-network pods, network namespaces, veth pairs and the bridge on a node, CoreDNS and a pod's resolv.conf |
| [DaemonSets](daemonsets.md) | one pod per node, kube-proxy and the CNI agent, taints |
| [Labels](labels.md) | keys and values, adding and removing, selectors, node role labels |
| [kubeconfig](kubeconfig.md) | clusters/users/contexts, resolution order, kubeadm's kubeconfigs |
| [RBAC](rbac.md) | Roles vs ClusterRoles, the two bindings, subjects, `auth can-i`, the roles every subject gets |
| [Namespaces](namespaces.md) | namespaces, namespaced vs cluster-scoped resources, `api-resources` |
| [API groups](api-groups.md) | the core group, named groups, `apiVersion`, groups in RBAC rules |
| [ServiceAccounts](service-accounts.md) | ServiceAccounts, their full names and groups, tokens in pods |
| [Authentication](authentication.md) | users and groups from certificates, `admin.conf` vs `super-admin.conf`, `auth whoami`, `--as` |
| [Helm](helm.md) | charts, repositories and releases, values and `--reuse-values`, revisions and rollback, where releases are stored, `helm template` |
| [Kustomize](kustomize.md) | bases and overlays, the fields an overlay sets, `labels` and selectors, patches, generated ConfigMap names, `-k` vs `-f` |
| [CRDs and operators](crds.md) | what a CRD adds, its parts, schema validation, operators and reconciling, CRDs in Helm charts |
| [Services](services.md) | what a Service is, ClusterIP, NodePort and LoadBalancer, how kube-proxy makes a Service IP answer, EndpointSlices |
| [Taints and tolerations](taints.md) | taints and tolerations, the three effects, the taints Kubernetes adds itself, `kubectl taint` |
| [Certificates](certificates.md) | certificates and the CA, client and serving certificates, the files in `/etc/kubernetes/pki/`, CSRs, expiry |
| [Workloads](workloads.md) | Deployments and ReplicaSets, the pod template, rollouts, StatefulSets, Jobs and CronJobs |
| [ConfigMaps and Secrets](config.md) | ConfigMaps, Secrets and their types, using both in a pod, `kube-root-ca.crt` |
