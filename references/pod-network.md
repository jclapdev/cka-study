# Pod network

Kubernetes requires that every pod gets its own IP and that any pod can reach any other pod on any node without NAT ([the Kubernetes network model](https://kubernetes.io/docs/concepts/services-networking/#the-kubernetes-network-model)). NAT (network address translation) is rewriting a packet's addresses on the way through, as a home router does, and pods must not need it to reach each other.

Kubernetes does not build this network itself. CNI (Container Network Interface) is the standard way for a separate program, a CNI plugin, to give each pod its address and connect it to the others ([network plugins](https://kubernetes.io/docs/concepts/extend-kubernetes/compute-storage-net/network-plugins/)). A cluster needs exactly one plugin, and [kubeadm](kubeadm.md) installs none. This lab uses [Flannel](#plugins). [How the pod network works](../learn/pod-network.md) explains the model.

## Three CIDRs, not one

A CIDR is a range of IP addresses written as a first address and a prefix length. `10.244.0.0/16` means every address that starts with the same first 16 bits as `10.244.0.0`, which is `10.244.0.0` to `10.244.255.255`, 65,536 addresses. `/24` fixes the first 24 bits, so `10.244.1.0/24` is the 256 addresses `10.244.1.0` to `10.244.1.255`.

| Range | Set by | Default | Who lives there |
| --- | --- | --- | --- |
| [Pod](pod.md) CIDR | [`kubeadm init`](https://kubernetes.io/docs/reference/setup-tools/kubeadm/kubeadm-init/) `--pod-network-cidr` | none | pods |
| [Service](services.md) CIDR | `kubeadm init --service-cidr` | `10.96.0.0/12` | [ClusterIPs](services.md#service-types) |
| [Node](workers.md) network | the infrastructure | none | node interfaces |

No interface holds a Service IP. [kube-proxy](control-plane.md#components) writes iptables or [IPVS](services.md#how-a-service-ip-answers) rules for it on every node ([virtual IPs](https://kubernetes.io/docs/reference/networking/virtual-ips/)), so a ClusterIP answers but never appears in `ip addr`.

All three must be disjoint. The controller-manager splits the pod CIDR into a `/24` per node and records it in the node's `spec.podCIDR`. In the lab:

```
NAME           CIDR
controlplane   10.244.0.0/24
node01         10.244.1.0/24
node02         10.244.2.0/24
```

The plugin's own configuration must contain those ranges. Flannel's is `10.244.0.0/16`. When they disagree, the Flannel pods crash-loop and [CoreDNS](#coredns) stays in `ContainerCreating`, but the nodes still go `Ready` (see below). The Flannel log names the cause:

| `init` was given | Flannel log |
| --- | --- |
| `--pod-network-cidr 10.10.0.0/16` | `failed to acquire lease: subnet "10.244.0.0/16" specified in the flannel net config doesn't contain "10.10.0.0/24" PodCIDR of the "controlplane" node` |
| no `--pod-network-cidr` | `failed to acquire lease: node "controlplane" pod cidr not assigned` |

Read it with `kubectl logs -n kube-flannel -l app=flannel`.

## Until a CNI exists

- Node condition `Ready` is `False`, reason `KubeletNotReady`, message `container runtime network not ready: NetworkReady=false reason:NetworkPluginNotReady message:Network plugin returns error: cni plugin not initialized` (wording after the first clause varies by kubelet version)
- CoreDNS pods stay `Pending`, because a `NotReady` node carries the [taint](taints.md) `node.kubernetes.io/not-ready:NoSchedule`, which CoreDNS does not tolerate
- `/etc/cni/net.d/` is empty (root-only directory: `sudo ls /etc/cni/net.d/`)

After a CNI plugin installs, that directory holds a conflist file, `10-flannel.conflist` for Flannel. A conflist is the plugin's configuration file in the CNI format, which tells the kubelet which plugin to call for each new pod. Once it exists, the kubelet marks the node `Ready`. In the lab this takes 16 seconds.

The file is the only thing the kubelet checks. Flannel's `install-cni` init container, a container that runs to completion before the pod's main container starts, copies it in before the Flannel agent starts, so the node goes `Ready` even when the agent then crash-loops. `Ready` means the configuration exists. Both CoreDNS pods `Running` means pods are getting addresses.

## Plugins

Flannel is a simple CNI plugin that connects the nodes' pod ranges into one network. It defaults to `10.244.0.0/16` and does not enforce NetworkPolicy, which is a set of rules for which pods may talk to which ([network policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/), [Flannel](https://github.com/flannel-io/flannel) (not available in the exam)):

```bash
kubectl apply -f https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml
```

Calico is another widely used CNI plugin. It enforces NetworkPolicy and defaults to `192.168.0.0/16`, so its [manifest](kubectl.md#generating-yaml) needs editing unless `init` used that range. With Flannel, a NetworkPolicy is accepted and has no effect.

The plugin's pods run as a [DaemonSet](daemonsets.md) that tolerates `NoSchedule` taints, so they start on `controlplane` while it is still `NotReady`. Flannel puts its DaemonSet in a [namespace](namespaces.md) of its own, `kube-flannel`, so `kubectl get pods -n kube-system` does not show it. Use `-A`.

## Pods on the host network

A pod with `hostNetwork: true` uses the node's own network and address instead of one from the pod CIDR ([pod networking](https://kubernetes.io/docs/concepts/workloads/pods/#pod-networking)). The [control plane](control-plane.md) [static pods](control-plane.md#static-pods), kube-proxy and the Flannel agent all do, which is why they run before any pod network exists:

```
NAME                                   HOSTNET
coredns-66bc5c9577-7s2xq               <none>
etcd-controlplane                      true
kube-apiserver-controlplane            true
kube-proxy-4wdrl                       true
```

So in `kubectl get pods -A -o wide`, these pods show the node's address, and only CoreDNS shows a `10.244.x` address.

## CoreDNS

CoreDNS is the cluster's DNS server, a [Deployment](workloads.md) of two replicas in `kube-system`, reachable at the service `kube-dns` on `10.96.0.10`. It resolves `<service>.<namespace>.svc.cluster.local` ([DNS for services and pods](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/)). It does not use the host network, so it needs an address from the pod network.

## Docs

- [Cluster networking](https://kubernetes.io/docs/concepts/cluster-administration/networking/)
- [Network plugins](https://kubernetes.io/docs/concepts/extend-kubernetes/compute-storage-net/network-plugins/)
- [DNS for services and pods](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/)
- [Customising CoreDNS](https://kubernetes.io/docs/tasks/administer-cluster/dns-custom-nameservers/)
- [Flannel](https://github.com/flannel-io/flannel) · [Calico quickstart](https://docs.tigera.io/calico/latest/getting-started/kubernetes/quickstart) (not available in the exam)

The CKA allows the documentation a task links in its [Quick Reference](kubectl.md#snippets-from-the-docs) box, which is where a plugin's docs would come from ([resources allowed](https://docs.linuxfoundation.org/tc-docs/certification/certification-resources-allowed) (not available in the exam)).

Related: [kubeadm](kubeadm.md), [pod](pod.md), [workers](workers.md), [control-plane](control-plane.md).
