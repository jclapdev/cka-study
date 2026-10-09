# Services

A Service is a stable address for a changing set of pods. [Pods](pod.md) come and go with new IPs each time, so clients don't connect to them directly. A Service picks its pods with a [label](labels.md) selector, gets one fixed IP and DNS name, and spreads connections across whichever pods match right now ([Service](https://kubernetes.io/docs/concepts/services-networking/service/)).

## Service types

The type decides who can reach the Service ([service types](https://kubernetes.io/docs/concepts/services-networking/service/#publishing-services-service-types)).

| Type | Reachable from | Address |
| --- | --- | --- |
| ClusterIP | inside the cluster only | an IP from the service [CIDR](pod-network.md#pod-service-and-node-address-ranges), such as `10.99.69.98`. This is the default. |
| NodePort | outside the cluster, on every node's IP | the ClusterIP plus a port from 30000 to 32767 opened on every node |
| LoadBalancer | outside, through a cloud load balancer | a NodePort plus an external IP that a cloud provider fills in. With no cloud, `EXTERNAL-IP` stays `<pending>`. |

`kubectl get svc` shows a NodePort as `80:32764/TCP`, which means the Service port 80 is reachable on port 32764 of every node.

## How a Service IP answers

No machine holds a Service IP. [kube-proxy](control-plane.md#components), a [DaemonSet](daemonsets.md) pod on every node, watches Services and writes packet-rewriting rules into each node's kernel. A connection to the ClusterIP is rewritten to one of the pods' IPs on the way out ([virtual IPs and service proxies](https://kubernetes.io/docs/reference/networking/virtual-ips/)). This is why a ClusterIP answers but never appears in `ip addr`.

kube-proxy writes iptables rules by default ([iptables mode](https://kubernetes.io/docs/reference/networking/virtual-ips/#proxy-mode-iptables)). IPVS is another Linux kernel feature for spreading connections across addresses, and kube-proxy uses it instead when its configuration sets `mode: ipvs` ([IPVS mode](https://kubernetes.io/docs/reference/networking/virtual-ips/#proxy-mode-ipvs)). [kubeadm](kubeadm.md) leaves `mode` empty, which means iptables.

An EndpointSlice is an object listing the pod IPs behind a Service, which the [control plane](control-plane.md) keeps up to date ([EndpointSlices](https://kubernetes.io/docs/concepts/services-networking/service/#endpointslices)). A Service whose selector matches no pods has an empty EndpointSlice, and connections to it are refused.

## On a new cluster

A new cluster has two Services. `kubernetes` is the apiserver, and `kube-dns` is [CoreDNS](pod-network.md#coredns):

```
NAMESPACE     NAME         TYPE        CLUSTER-IP    EXTERNAL-IP   PORT(S)                  AGE
default       kubernetes   ClusterIP   10.96.0.1     <none>        443/TCP                  5d11h
kube-system   kube-dns     ClusterIP   10.96.0.10    <none>        53/UDP,53/TCP,9153/TCP   5d11h
```

A [Deployment](workloads.md) `web` with two pods in the namespace `default`, exposed with `kubectl expose deployment web --port 80`:

```
NAME          TYPE        CLUSTER-IP    EXTERNAL-IP   PORT(S)   AGE
service/web   ClusterIP   10.99.69.98   <none>        80/TCP    14s

NAME                                       ADDRESSTYPE   PORTS   ENDPOINTS               AGE
endpointslice.discovery.k8s.io/web-xc5mj   IPv4          80      10.244.2.2,10.244.1.2   14s
```

The rule kube-proxy wrote for it on a node (`sudo iptables -t nat -S KUBE-SERVICES`):

```
-A KUBE-SERVICES -d 10.99.69.98/32 -p tcp -m comment --comment "default/web cluster IP" -m tcp --dport 80 -j KUBE-SVC-RWPXEWV2W6XBCCKP
```

Inside the cluster, a pod reaches it by name: `wget -qO- web` from a pod in the same namespace, or `web.<namespace>.svc.cluster.local` from anywhere.

## Commands

```bash
kubectl expose deployment web --port 80                     # ClusterIP Service for a Deployment's pods
kubectl expose deployment web --port 80 --type NodePort
kubectl create service clusterip web --tcp 80:8080          # Service port 80 to container port 8080
kubectl get svc,endpointslices
```

## Failure modes

| Symptom | Cause |
| --- | --- |
| `ENDPOINTS` is empty, and a client gets `wget: can't connect to remote host (10.106.236.200): Connection refused` | The selector matches no ready pods. Compare the Service's selector with `kubectl get pods --show-labels`. |
| `wget: bad address 'web'` from a pod | No Service `web` exists in the pod's own namespace. A name without a namespace finds only those; use `web.<namespace>` for one in another namespace ([namespaces of Services](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/#namespaces-of-services)). |
| Connections time out or are refused on the right IP | `targetPort` doesn't match the port the container listens on. |
| `EXTERNAL-IP` stays `<pending>` | The Service is a LoadBalancer and no cloud provider exists to give it an address. |

## Docs

- [Service](https://kubernetes.io/docs/concepts/services-networking/service/)
- [Virtual IPs and service proxies](https://kubernetes.io/docs/reference/networking/virtual-ips/)
- [DNS for services and pods](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/)
