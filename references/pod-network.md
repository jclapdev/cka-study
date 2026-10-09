# Pod network

Kubernetes requires that every pod gets its own IP and that any pod can reach any other pod on any node without NAT ([the Kubernetes network model](https://kubernetes.io/docs/concepts/services-networking/#the-kubernetes-network-model)). NAT (network address translation) is rewriting a packet's addresses on the way through, as a home router does, and pods must not need it to reach each other.

Kubernetes does not build this network itself. CNI (Container Network Interface) is the standard way for a separate program, a CNI plugin, to give each pod its address and connect it to the others ([network plugins](https://kubernetes.io/docs/concepts/extend-kubernetes/compute-storage-net/network-plugins/)). A cluster needs exactly one plugin, and [kubeadm](kubeadm.md) installs none. [How the pod network works](../learn/pod-network.md) explains the model.

## Three CIDRs, not one

A CIDR is a range of IP addresses written as a first address and a prefix length. `10.244.0.0/16` means every address that starts with the same first 16 bits as `10.244.0.0`, which is `10.244.0.0` to `10.244.255.255`, 65,536 addresses. `/24` fixes the first 24 bits, so `10.244.1.0/24` is the 256 addresses `10.244.1.0` to `10.244.1.255`.

| Range | Set by | Default | Who lives there |
| --- | --- | --- | --- |
| [Pod](pod.md) CIDR | [`kubeadm init`](https://kubernetes.io/docs/reference/setup-tools/kubeadm/kubeadm-init/) `--pod-network-cidr` | none | pods |
| [Service](services.md) CIDR | `kubeadm init --service-cidr` | `10.96.0.0/12` | [ClusterIPs](services.md#service-types) |
| [Node](workers.md) network | the infrastructure | none | node interfaces |

No interface holds a Service IP. [kube-proxy](control-plane.md#components) writes iptables or [IPVS](services.md#how-a-service-ip-answers) rules for it on every node ([virtual IPs](https://kubernetes.io/docs/reference/networking/virtual-ips/)), so a ClusterIP answers but never appears in `ip addr`.

All three must be disjoint. The controller-manager splits the pod CIDR into a `/24` per node and records it in the node's `spec.podCIDR`. On a cluster with two workers:

```
NAME           CIDR
controlplane   10.244.0.0/24
node01         10.244.1.0/24
node02         10.244.2.0/24
```

The plugin's own configuration must contain those ranges. [Flannel](#plugins)'s is `10.244.0.0/16`. When they disagree, the Flannel pods crash-loop and [CoreDNS](#coredns) stays in `ContainerCreating`, but the nodes still go `Ready` (see below). The Flannel log names the cause:

| `init` was given | Flannel log |
| --- | --- |
| `--pod-network-cidr 10.10.0.0/16` | `failed to acquire lease: subnet "10.244.0.0/16" specified in the flannel net config doesn't contain "10.10.0.0/24" PodCIDR of the "controlplane" node` |
| no `--pod-network-cidr` | `failed to acquire lease: node "controlplane" pod cidr not assigned` |

Read it with `kubectl logs -n kube-flannel -l app=flannel`.

## Until a CNI exists

- Node condition `Ready` is `False`, reason `KubeletNotReady`, message `container runtime network not ready: NetworkReady=false reason:NetworkPluginNotReady message:Network plugin returns error: cni plugin not initialized` (wording after the first clause varies by kubelet version)
- CoreDNS pods stay `Pending`, because a `NotReady` node carries the [taint](taints.md) `node.kubernetes.io/not-ready:NoSchedule`, which CoreDNS does not tolerate
- `/etc/cni/net.d/` is empty (root-only directory: `sudo ls /etc/cni/net.d/`)

After a CNI plugin installs, that directory holds a conflist file, `10-flannel.conflist` for Flannel. A conflist is the plugin's configuration file in the CNI format, which tells the kubelet which plugin to call for each new pod. Once it exists, the kubelet marks the node `Ready` within seconds.

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

## Network namespaces on a node

A network namespace is a separate copy of Linux's network: its own interfaces, addresses and routes. Each pod that is not on the host network gets one, shared by all its containers ([pod networking](https://kubernetes.io/docs/concepts/workloads/pods/#pod-networking)). A veth pair is two virtual interfaces joined like a cable, with one end in the pod's namespace as `eth0` and the other on the node. Flannel plugs the node ends into a bridge, a virtual switch called `cni0`. [How a pod gets its own network](../learn/network-namespaces.md) explains how they fit together.

On a node, as root:

```bash
ip netns list                         # one namespace per pod, named cni-<id>
ip -br link                           # the node's interfaces, with a veth per pod
ip route                              # where each pod range goes
ip netns exec <namespace> ip -br addr # the pod's own interfaces
bridge link                           # which veths are plugged into cni0
```

On `node01`, `ip -br link` (trimmed) shows the node's own `eth0`, Flannel's `flannel.1` and `cni0`, and one veth per pod:

```
eth0@if190       UP             ce:2d:c0:0e:1a:ec <BROADCAST,MULTICAST,UP,LOWER_UP>
flannel.1        UNKNOWN        8e:ae:cd:b0:c6:70 <BROADCAST,MULTICAST,UP,LOWER_UP>
cni0             UP             aa:f6:71:cf:2d:ae <BROADCAST,MULTICAST,UP,LOWER_UP>
veth6fc5ef35@if11 UP             ca:38:90:7a:27:41 <BROADCAST,MULTICAST,UP,LOWER_UP>
vethadd4ba8e@if11 UP             86:58:22:28:a3:11 <BROADCAST,MULTICAST,UP,LOWER_UP>
```

`ip route` sends the node's own pod range to `cni0` and the other nodes' ranges to `flannel.1`:

```
default via 192.0.2.1 dev eth0
10.244.0.0/24 via 10.244.0.0 dev flannel.1 onlink
10.244.1.0/24 dev cni0 proto kernel scope link src 10.244.1.1
10.244.2.0/24 via 10.244.2.0 dev flannel.1 onlink
192.0.2.0/24 dev eth0 proto kernel scope link src 192.0.2.11
```

Inside one pod's namespace, `eth0@if14` is the pod's end of the pair, and `if14` is the number of its other end on the node, the fourteenth interface, which `bridge link` shows plugged into `cni0`:

```
lo               UNKNOWN        127.0.0.1/8 ::1/128
eth0@if14        UP             10.244.1.2/24 fe80::d485:2bff:feb3:8a40/64
```

VXLAN is a way of carrying one network's packets inside another's. `flannel.1` is a VXLAN interface: it wraps each packet for another node's pods in a UDP packet between the two nodes' addresses, on port 8472. `ip -d link show flannel.1` shows `vxlan id 1 … dstport 8472`.

## CoreDNS

CoreDNS is the cluster's DNS server, a [Deployment](workloads.md) of two replicas in `kube-system`, reachable at the service `kube-dns` on `10.96.0.10`. It resolves `<service>.<namespace>.svc.cluster.local` ([DNS for services and pods](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/)). It does not use the host network, so it needs an address from the pod network. [How DNS works in the cluster](../learn/dns.md) explains how a name is looked up.

The kubelet writes each pod's `/etc/resolv.conf` from its `clusterDNS` and `clusterDomain` settings in `/var/lib/kubelet/config.yaml`. In a pod in `default`:

```
search default.svc.cluster.local svc.cluster.local cluster.local
nameserver 10.96.0.10
options ndots:5
```

The Corefile is CoreDNS's configuration file, kept in the [ConfigMap](config.md) `coredns` in `kube-system` ([CoreDNS ConfigMap options](https://kubernetes.io/docs/tasks/administer-cluster/dns-custom-nameservers/#coredns-configmap-options)). `kubernetes cluster.local in-addr.arpa ip6.arpa` answers cluster names, and `forward . /etc/resolv.conf` sends every other name to the node's DNS server:

```bash
kubectl get cm coredns -n kube-system -o jsonpath='{.data.Corefile}'
kubectl run tmp --rm -i --restart=Never --image=busybox:1.37 -- nslookup web   # look a name up from a pod
```

busybox's `nslookup` tries every search suffix and prints a line such as `** server can't find web.svc.cluster.local: NXDOMAIN` for each one with no record, even when the name resolves. NXDOMAIN is the DNS answer for a name with no record. The answer is in the `Name:` and `Address:` lines:

```
Name:	web.default.svc.cluster.local
Address: 10.104.158.216
```

## Docs

- [Cluster networking](https://kubernetes.io/docs/concepts/cluster-administration/networking/)
- [Network plugins](https://kubernetes.io/docs/concepts/extend-kubernetes/compute-storage-net/network-plugins/)
- [DNS for services and pods](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/)
- [Customising CoreDNS](https://kubernetes.io/docs/tasks/administer-cluster/dns-custom-nameservers/)
- [Flannel](https://github.com/flannel-io/flannel) · [Calico quickstart](https://docs.tigera.io/calico/latest/getting-started/kubernetes/quickstart) (not available in the exam)

Related: [kubeadm](kubeadm.md), [Pod](pod.md), [Workers](workers.md), [Control plane](control-plane.md).
