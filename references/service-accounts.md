# ServiceAccounts

A ServiceAccount is an identity for software running in the cluster, such as a pod or a CI job. It is the only kind of identity that exists as a Kubernetes object. Users and groups come from credentials and have no object; see [authentication](authentication.md) ([service accounts](https://kubernetes.io/docs/concepts/security/service-accounts/)).

## The model

- A ServiceAccount is namespaced. Its full username is `system:serviceaccount:<namespace>:<name>`, which is the name `--as` and the Forbidden message use.
- It belongs to two groups automatically: `system:serviceaccounts`, which covers every ServiceAccount, and `system:serviceaccounts:<namespace>`, which covers every ServiceAccount in its namespace. A binding can name either group.
- A new ServiceAccount has no permissions. It can only do what [RBAC](rbac.md) bindings grant it.
- Every namespace gets a ServiceAccount called `default` as soon as it is created ([default service accounts](https://kubernetes.io/docs/concepts/security/service-accounts/#default-service-accounts)). A pod that names no ServiceAccount runs as `default`.

## How a pod uses one

The kubelet mounts a short-lived token for the pod's ServiceAccount into the pod, through a projected volume named `kube-api-access-<random>` ([assign to a pod](https://kubernetes.io/docs/concepts/security/service-accounts/#assign-to-pod)). Software in the pod sends that token to the apiserver, and the apiserver authenticates it as the ServiceAccount.

```yaml
spec:
  serviceAccountName: deploy-bot
```

`kubectl create token <name>` issues a token by hand, which is useful for testing ([get a token](https://kubernetes.io/docs/concepts/security/service-accounts/#get-a-token)).

## In this lab

```bash
kubectl create serviceaccount deploy-bot -n dev
kubectl get serviceaccounts -n dev
kubectl auth whoami --as=system:serviceaccount:dev:deploy-bot
```

In the lab, `whoami` prints:

```
ATTRIBUTE   VALUE
Username    system:serviceaccount:dev:deploy-bot
Groups      [system:serviceaccounts system:serviceaccounts:dev system:authenticated]
```

CoreDNS runs as the ServiceAccount `coredns` in `kube-system`, and its pods carry a `kube-api-access-…` volume.

## Failure modes

| Symptom | Cause |
| --- | --- |
| A binding exists and the ServiceAccount still gets `no` | The binding names a different namespace or a misspelled name. Bindings are not checked against real ServiceAccounts. |
| A pod gets `Forbidden` from the apiserver | The pod runs as `default` or another ServiceAccount with no binding. Check `spec.serviceAccountName`. |
| `pods "p" is forbidden: error looking up service account dev/x: serviceaccount "x" not found` | The ServiceAccount must exist in the pod's namespace before the pod is created. |

## Docs

- [Service accounts](https://kubernetes.io/docs/concepts/security/service-accounts/)
- [Configure service accounts for pods](https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/)
- [`kubectl create serviceaccount`](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_create/kubectl_create_serviceaccount/) · [`kubectl create token`](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_create/kubectl_create_token/)
