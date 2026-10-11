# How kubeadm builds a cluster

A cluster needs more than its programs. The apiserver is the control plane's front door that everything talks to. Every component needs a certificate, a signed file that proves who it is, so the others can trust it. Every component needs a kubeconfig, a file that says where the apiserver is. And the control plane needs a way to start before the apiserver exists. kubeadm does that setup. It turns machines that already have a container runtime, the program that starts containers, and a kubelet, the agent that runs pods on a machine, into a cluster, and it leaves out everything a cluster can choose for itself, such as the pod network, which connects pods across machines ([kubeadm init](https://kubernetes.io/docs/reference/setup-tools/kubeadm/kubeadm-init/)).

## Building the control plane

`kubeadm init` runs on the machine that becomes the control plane, in a fixed order where each step depends on the one before ([init workflow](https://kubernetes.io/docs/reference/setup-tools/kubeadm/kubeadm-init/#init-workflow)):

```mermaid
flowchart TD
  P[preflight<br/>check the machine] --> C[certs<br/>a cluster certificate authority signs a certificate for each component]
  C --> K[kubeconfig<br/>a file per component naming the apiserver and its identity]
  K --> M[a file per control plane program<br/>for the kubelet to start]
  M --> L[kubelet starts<br/>and runs those manifests]
  L --> A[addons<br/>CoreDNS for DNS names, kube-proxy for Service addresses]
```

Certificates come first because everything after them uses them. The cluster CA, a certificate authority that kubeadm creates, signs a certificate for every component. A component trusts another one when its certificate was signed by that CA. The apiserver's own certificate lists every address it answers on. A client that connects on any other address refuses the connection. So kubeadm asks up front for the advertise address, the address the apiserver tells other machines to reach it on, and changing it later means building the control plane again.

The control plane components are written as static pod manifests, files the kubelet reads straight from disk, so they start without an apiserver to ask ([how a cluster works](cluster-architecture.md#how-the-control-plane-starts-itself)).

## Joining a node

A new node and the control plane start with no trust in either direction. The join command carries one secret each way ([TLS bootstrapping](https://kubernetes.io/docs/reference/access-authn-authz/kubelet-tls-bootstrapping/)):

```mermaid
sequenceDiagram
  participant W as kubelet on the new node
  participant A as kube-apiserver
  W->>A: connect to the advertise address on 6443
  A-->>W: serving certificate
  W->>W: hash the cluster CA, compare to the hash in the join command
  W->>A: authenticate with the token in the join command, ask for a certificate
  A-->>W: a signed client certificate
  W->>A: register the node under its own identity
```

The CA hash lets the node check that it reached the right cluster. The bootstrap token lets the apiserver accept the node for long enough to sign it a certificate ([bootstrap tokens](https://kubernetes.io/docs/reference/access-authn-authz/bootstrap-tokens/)). After the join, the node proves who it is with its own certificate, and the token is no longer needed.

## What kubeadm leaves out

kubeadm installs no pod network, the plugin that gives pods addresses and lets them reach each other across nodes, so a new cluster's nodes stay `NotReady` until you install one ([how the pod network works](pod-network.md)).

The [kubeadm](../references/kubeadm.md) reference has the phases, files, commands and errors, and the [workers](../references/workers.md#joining) reference has the join.

## Further reading

- [Creating a cluster with kubeadm](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/create-cluster-kubeadm/)
- [kubeadm implementation details](https://kubernetes.io/docs/reference/setup-tools/kubeadm/implementation-details/)
- [PKI certificates and requirements](https://kubernetes.io/docs/setup/best-practices/certificates/)
- [TLS bootstrapping](https://kubernetes.io/docs/reference/access-authn-authz/kubelet-tls-bootstrapping/)
