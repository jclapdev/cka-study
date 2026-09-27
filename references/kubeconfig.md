# kubeconfig

The file `kubectl` reads to learn where the apiserver is and how to prove identity. Three lists plus a pointer:

| Section | Holds |
| --- | --- |
| `clusters` | apiserver URL and the CA cert that signs it |
| `users` | credentials — client cert/key, token, or exec plugin |
| `contexts` | a named (cluster, user, namespace) triple |
| `current-context` | which context applies when no flag says otherwise |

Nothing in the file is a permission. It is identity only; what that identity may do is RBAC.

## Resolution order

The full rules: [merging kubeconfig files](https://kubernetes.io/docs/concepts/configuration/organize-cluster-access-kubeconfig/#merging-kubeconfig-files).

1. `--kubeconfig <file>`
2. `$KUBECONFIG` — colon-separated list, merged left to right
3. `~/.kube/config`

`sudo kubectl` runs as root, so it reads `/root/.kube/config` — not the invoking user's. This is the usual reason a command works one moment and fails the next.

## On a kubeadm cluster

`kubeadm init` writes root-owned kubeconfigs to `/etc/kubernetes/`:

| File | Identity |
| --- | --- |
| `admin.conf` | `kubernetes-admin`, group `system:masters` — full access |
| `super-admin.conf` | bypasses even RBAC deny rules (1.29+) |
| `kubelet.conf`, `controller-manager.conf`, `scheduler.conf` | the components' own identities |

Making it usable unprivileged is a copy and a chown:

```bash
mkdir -p ~/.kube
sudo cp /etc/kubernetes/admin.conf ~/.kube/config
sudo chown "$(id -u):$(id -g)" ~/.kube/config
```

`export KUBECONFIG=/etc/kubernetes/admin.conf` also works but only for that shell, and reading a root-only file as a normal user fails anyway.

## Commands

Every subcommand: [`kubectl config`](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_config/).

```bash
kubectl config view                                  # merged, credentials redacted
kubectl config get-contexts
kubectl config use-context <name>
kubectl config set-context --current --namespace=dev  # stop typing -n dev
kubectl config current-context
```

Setting the namespace on the context is worth seconds per command on an exam where a task names one namespace repeatedly.

## Failure modes

| Symptom | Cause |
| --- | --- |
| `connection to the server localhost:8080 was refused` | no kubeconfig found at all — the fallback default |
| `You must be logged in to the server (Unauthorized)` | credentials present but wrong or expired |
| `x509: certificate signed by unknown authority` | cluster CA does not match the apiserver's |
| `Forbidden` | identity is fine; [RBAC](rbac.md) says no |

## Docs

- [Organising cluster access with kubeconfig](https://kubernetes.io/docs/concepts/configuration/organize-cluster-access-kubeconfig/)
- [Configuring access to multiple clusters](https://kubernetes.io/docs/tasks/access-application-cluster/configure-access-multiple-clusters/)
- [Controlling access to the API](https://kubernetes.io/docs/concepts/security/controlling-access/)
- [Service accounts](https://kubernetes.io/docs/concepts/security/service-accounts/)

Related: [control-plane](control-plane.md), [workers](workers.md).
