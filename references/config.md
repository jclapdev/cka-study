# ConfigMaps and Secrets

A ConfigMap holds configuration as key-value pairs, kept apart from the container image so the same image runs with different settings. A pod reads it as environment variables or as files in a mounted directory ([ConfigMaps](https://kubernetes.io/docs/concepts/configuration/configmap/)).

## Secrets

A Secret works like a ConfigMap but is meant for passwords, tokens and keys ([Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)). Its values are stored base64-encoded, which hides them from a glance but doesn't encrypt them: anyone allowed to read the Secret can decode it. What protects a Secret is [RBAC](rbac.md), since reading Secrets is a separate permission from reading ConfigMaps.

```
data:
  password: czNjcmV0
```

`kubectl get secret db -o jsonpath='{.data.password}' | base64 -d` prints `s3cret`.

A Secret's type says what it holds and which keys it must have ([Secret types](https://kubernetes.io/docs/concepts/configuration/secret/#secret-types)):

| Type | Holds |
| --- | --- |
| `Opaque` | any keys. This is the default, and the type of `kubectl create secret generic`. |
| `kubernetes.io/tls` | a [certificate](certificates.md) and its key, under `tls.crt` and `tls.key` |
| `kubernetes.io/dockerconfigjson` | credentials for pulling images from a private registry |
| `kubernetes.io/service-account-token` | a long-lived [ServiceAccount](service-accounts.md) token |
| `helm.sh/release.v1` | a [Helm](helm.md) release record. Helm sets this type itself. |

## Using them in a pod

The same pod spec reads a whole ConfigMap with `envFrom` and one Secret key with `valueFrom` ([ConfigMaps as environment variables](https://kubernetes.io/docs/concepts/configuration/configmap/#using-configmaps-as-environment-variables)):

```yaml
envFrom:
- configMapRef:
    name: app-config
env:
- name: PASSWORD
  valueFrom:
    secretKeyRef:
      name: db
      key: password
```

The container sees `MODE=prod` and `PASSWORD=s3cret`. Environment variables are read once, when the container starts, so a change to the ConfigMap reaches the pod only after it restarts. A ConfigMap mounted as files is updated in place after a short delay ([mounted ConfigMaps are updated automatically](https://kubernetes.io/docs/concepts/configuration/configmap/#mounted-configmaps-are-updated-automatically)).

## kube-root-ca.crt

Every namespace has a ConfigMap `kube-root-ca.crt` that holds the cluster CA's certificate, `ca.crt`, so pods can check the [apiserver](control-plane.md#components)'s certificate. The [control plane](control-plane.md) creates it in each new namespace:

```
NAME                         DATA   AGE
configmap/app-config         2      0s
configmap/kube-root-ca.crt   1      107s

NAME        TYPE     DATA   AGE
secret/db   Opaque   1      0s
```

## Commands

```bash
kubectl create configmap app-config --from-literal MODE=prod --from-literal LOG_LEVEL=info
kubectl create configmap app-config --from-file app.properties
kubectl create secret generic db --from-literal password=s3cret
kubectl create secret tls web-tls --cert tls.crt --key tls.key
kubectl get secret db -o jsonpath='{.data.password}' | base64 -d
```

## Docs

- [ConfigMaps](https://kubernetes.io/docs/concepts/configuration/configmap/)
- [Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)
- [Configure a pod to use a ConfigMap](https://kubernetes.io/docs/tasks/configure-pod-container/configure-pod-configmap/)
