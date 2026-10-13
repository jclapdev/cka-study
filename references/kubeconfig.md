# kubeconfig

A kubeconfig is the file `kubectl` reads to learn where the [apiserver](control-plane.md#components) is and how to prove who you are. It holds three lists, and a pointer to the entry in use:

| Section | Holds |
| --- | --- |
| `clusters` | The apiserver's URL, and the certificate of the [CA](certificates.md), the certificate authority that signed the apiserver's certificate. |
| `users` | credentials: a client certificate and key, a token, or a command to run that returns one |
| `contexts` | a named (cluster, user, namespace) triple |
| `current-context` | which context applies when no flag says otherwise |

Nothing in the file is a permission. It is identity only; what that identity may do is [RBAC](rbac.md).

## Resolution order

[Merging kubeconfig files](https://kubernetes.io/docs/concepts/configuration/organize-cluster-access-kubeconfig/#merging-kubeconfig-files) has the full rules.

1. `--kubeconfig <file>`
2. `$KUBECONFIG`, a colon-separated list of files, merged left to right
3. `~/.kube/config`

`sudo kubectl` runs as root, so it reads `/root/.kube/config`, not the invoking user's. When root has no kubeconfig of its own on the [control plane](control-plane.md) node, `sudo kubectl get nodes` fails with `localhost:8080 was refused` while plain `kubectl get nodes` works.

## kubeadm's kubeconfigs

`kubeadm init` writes root-owned kubeconfigs to `/etc/kubernetes/`:

| File | Identity |
| --- | --- |
| `admin.conf` | `kubernetes-admin`, group `kubeadm:cluster-admins`, which a [ClusterRoleBinding](rbac.md#the-model) binds to `cluster-admin` |
| `super-admin.conf` | `kubernetes-super-admin`, group `system:masters`, which skips RBAC entirely. For when RBAC itself is broken ([authentication](authentication.md)) |
| `kubelet.conf`, `controller-manager.conf`, `scheduler.conf` | the components' own identities |

The files are root-owned with mode `600`. To use `admin.conf` as a normal user, copy it and change its owner:

```bash
mkdir -p ~/.kube
sudo cp /etc/kubernetes/admin.conf ~/.kube/config
sudo chown "$(id -u):$(id -g)" ~/.kube/config
```

Without the `chown`, the copy is still root-owned and kubectl cannot read it. `export KUBECONFIG=/etc/kubernetes/admin.conf` only works for root, because a normal user cannot read that file.

## Commands

[`kubectl config`](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_config/) lists every subcommand.

```bash
kubectl config view                                  # merged, credentials redacted
kubectl config get-contexts
kubectl config use-context <name>
kubectl config set-context --current --namespace=dev  # stop typing -n dev
kubectl config current-context
```

## Failure modes

| Symptom | Cause |
| --- | --- |
| `connection to the server localhost:8080 was refused` | No kubeconfig was found, so kubectl used its built-in default. Often `sudo`, or a worker node. |
| `error loading config file "/home/<user>/.kube/config": open /home/<user>/.kube/config: permission denied` | The copied file is still root-owned. Run the `chown`. |
| `You must be logged in to the server (Unauthorized)` | The credentials are there but wrong or expired. |
| `x509: certificate signed by unknown authority` | The kubeconfig's cluster CA is not the one that signed the apiserver's certificate. |
| `Forbidden` | The identity is fine, and RBAC refused the request. |

## Docs

- [Organizing cluster access using kubeconfig files](https://kubernetes.io/docs/concepts/configuration/organize-cluster-access-kubeconfig/)
- [Configuring access to multiple clusters](https://kubernetes.io/docs/tasks/access-application-cluster/configure-access-multiple-clusters/)
- [Controlling access to the API](https://kubernetes.io/docs/concepts/security/controlling-access/)
- [Service accounts](https://kubernetes.io/docs/concepts/security/service-accounts/)

Related: [Control plane](control-plane.md), [Workers](workers.md).
