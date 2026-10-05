# Authentication

Authentication is how the [apiserver](control-plane.md#components) learns who sent a request. It turns the request's credential into a username and a list of groups. It does not decide what that identity may do; [RBAC](rbac.md) does that next ([authenticating](https://kubernetes.io/docs/reference/access-authn-authz/authentication/)).

## Users and groups have no object

Kubernetes has no User or Group resource ([users in Kubernetes](https://kubernetes.io/docs/reference/access-authn-authz/authentication/#users-in-kubernetes)). A user or group exists only because a credential asserts its name. So:

- You cannot create, list or delete a user with `kubectl`.
- A binding can name a user or group that no credential has ever asserted, and it is accepted.
- To remove a user's access, you remove their bindings or stop trusting their credential.

[ServiceAccounts](service-accounts.md) are the exception. They are objects, and the apiserver issues their tokens.

## Client certificates

For a client [certificate](certificates.md) signed by the cluster [CA](certificates.md), the certificate's common name (`CN`) becomes the username, and each organisation (`O`) becomes a group ([X509 client certificates](https://kubernetes.io/docs/reference/access-authn-authz/authentication/#x509-client-certificates)).

## In this lab

[kubeadm](kubeadm.md) writes two admin [kubeconfigs](kubeconfig.md), each with a client certificate:

| File | Certificate subject | Why it has full access |
| --- | --- | --- |
| `admin.conf` | `O = kubeadm:cluster-admins, CN = kubernetes-admin` | The [ClusterRoleBinding](rbac.md#the-model) `kubeadm:cluster-admins` binds that group to `cluster-admin`. |
| `super-admin.conf` | `O = system:masters, CN = kubernetes-super-admin` | `system:masters` skips RBAC entirely, so the file still works when RBAC is broken ([kubeadm kubeconfig files](https://kubernetes.io/docs/reference/setup-tools/kubeadm/implementation-details/)). |

`~/.kube/config` is a copy of `admin.conf`. To read a kubeconfig's certificate subject:

```bash
sudo grep client-certificate-data /etc/kubernetes/admin.conf | awk '{print $2}' | base64 -d | openssl x509 -noout -subject
```

## Commands

`kubectl auth whoami` asks the apiserver who it thinks you are ([self subject review](https://kubernetes.io/docs/reference/access-authn-authz/authentication/#self-subject-review)):

```bash
kubectl auth whoami
```

`--as` and `--as-group` make one request as someone else, without their credential ([user impersonation](https://kubernetes.io/docs/reference/access-authn-authz/authentication/#user-impersonation)). It works because `cluster-admin` allows the `impersonate` verb. `--as-group` needs `--as` as well:

```bash
kubectl auth can-i list pods -n dev --as=system:serviceaccount:dev:deploy-bot
kubectl auth can-i list pods -n dev --as=anyone --as-group=auditors
```

## Failure modes

| Symptom | Cause |
| --- | --- |
| `error: You must be logged in to the server (Unauthorized)` | The credential is wrong or expired, or it was signed by a different CA. |
| `Forbidden` | Authentication worked. RBAC denied the request. |
| A binding for a user does nothing | The name in the binding does not exactly match the certificate's `CN`. Names are case-sensitive. |

## Docs

- [Authenticating](https://kubernetes.io/docs/reference/access-authn-authz/authentication/)
- [Controlling access to the Kubernetes API](https://kubernetes.io/docs/concepts/security/controlling-access/)
- [`kubectl auth whoami`](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_auth/kubectl_auth_whoami/)
