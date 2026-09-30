# kubeadm

kubeadm turns machines that already run a container runtime and a kubelet into a cluster. `kubeadm init` builds the control plane on one machine, and `kubeadm join` adds more machines to it ([kubeadm init](https://kubernetes.io/docs/reference/setup-tools/kubeadm/kubeadm-init/)). It does not install a pod network; see [pod-network](pod-network.md).

## What `kubeadm init` does

`init` runs a fixed list of phases, and each line it prints starts with the phase's name in brackets ([init workflow](https://kubernetes.io/docs/reference/setup-tools/kubeadm/kubeadm-init/#init-workflow)). In the lab, one run prints 84 lines and takes about 90 seconds.

| Phase | What it does |
| --- | --- |
| `[preflight]` | Checks the machine and pulls the control plane images. A failed check stops `init` before it changes anything. |
| `[certs]` | Creates a cluster CA and every certificate the components need, under `/etc/kubernetes/pki/`. |
| `[kubeconfig]` | Writes `admin.conf`, `super-admin.conf`, `kubelet.conf`, `controller-manager.conf` and `scheduler.conf` to `/etc/kubernetes/`. |
| `[etcd]`, `[control-plane]` | Writes the four static pod manifests to `/etc/kubernetes/manifests/`. |
| `[kubelet-start]`, `[wait-control-plane]` | Starts the kubelet, which starts the static pods, and waits for them to be healthy. |
| `[mark-control-plane]` | Labels and taints the node as a control plane node. |
| `[bootstrap-token]` | Creates the token that `kubeadm join` uses, valid for 24 hours. |
| `[addons]` | Installs CoreDNS and kube-proxy. |

The files it leaves on the control plane node:

| Path | Contents |
| --- | --- |
| `/etc/kubernetes/manifests/` | The static pod manifests ([control-plane](control-plane.md)). |
| `/etc/kubernetes/*.conf` | The kubeconfigs, root-owned with mode `600` ([kubeconfig](kubeconfig.md)). |
| `/etc/kubernetes/pki/` | The CA and all component certificates ([which certificate is which](https://kubernetes.io/docs/setup/best-practices/certificates/#all-certificates)). |
| `/var/lib/etcd/` | The etcd data directory. |
| `/var/lib/kubelet/config.yaml` | The kubelet's configuration. |

## The advertise address

`--apiserver-advertise-address` is the address the apiserver tells the rest of the cluster to reach it on. `init` writes it into the apiserver's certificate, into every kubeconfig, and into the join command. In the lab:

```
[certs] apiserver serving cert is signed for DNS names [controlplane kubernetes kubernetes.default kubernetes.default.svc kubernetes.default.svc.cluster.local] and IPs [10.96.0.1 192.168.104.10]
```

A client that connects on an address missing from that list fails the certificate check:

```
Unable to connect to the server: tls: failed to verify certificate: x509: certificate is valid for 10.96.0.1, 192.168.104.10, not 127.0.0.1
```

Changing the address means `kubeadm reset` and a new `init`.

## Commands

```bash
sudo kubeadm init --apiserver-advertise-address <ip> --pod-network-cidr 10.244.0.0/16
sudo kubeadm token list
sudo kubeadm token create --print-join-command   # a new join command with a new token
sudo kubeadm reset -f                            # undo init or join on this machine
```

`kubeadm reset` does not empty `/etc/cni/net.d/` ([cleanup of CNI configuration](https://kubernetes.io/docs/reference/setup-tools/kubeadm/kubeadm-reset/#cleanup-of-cni-configuration)). A plugin's leftover configuration there is used by the next cluster built on that machine.

## Failure modes

| Symptom | Cause |
| --- | --- |
| `[ERROR Port-6443]: Port 6443 is in use` and `[ERROR FileAvailable--etc-kubernetes-manifests-kube-apiserver.yaml]: … already exists` | A control plane already runs on this machine. Run `sudo kubeadm reset -f` first. |
| `[ERROR DirAvailable--var-lib-etcd]: /var/lib/etcd is not empty` | An earlier `init` left etcd data. `kubeadm reset -f` removes it. |
| `[WARNING Swap]: swap is supported for cgroup v2 only…`, then `error execution phase wait-control-plane` | Swap is on. Preflight only warns, but the kubelet refuses to start: `journalctl -u kubelet` shows `running with swap on is not supported`. Turn swap off with `sudo swapoff -a` ([swap configuration](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/install-kubeadm/#swap-configuration)). |
| `x509: certificate is valid for …, not <address>` | The client used an address that is not in the apiserver's certificate. Use the advertise address. |
| `kubeadm join` does not finish | The worker cannot reach the advertise address on port 6443, or the token has expired. See [workers](workers.md). |

## Docs

- [Creating a cluster with kubeadm](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/create-cluster-kubeadm/)
- [kubeadm init](https://kubernetes.io/docs/reference/setup-tools/kubeadm/kubeadm-init/) · [kubeadm reset](https://kubernetes.io/docs/reference/setup-tools/kubeadm/kubeadm-reset/) · [kubeadm token](https://kubernetes.io/docs/reference/setup-tools/kubeadm/kubeadm-token/)
- [PKI certificates and requirements](https://kubernetes.io/docs/setup/best-practices/certificates/)
- [Troubleshooting kubeadm](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/troubleshooting-kubeadm/)
