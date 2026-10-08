# API groups

An API group is a family of related resource types, such as `apps` for [Deployments](workloads.md) and [DaemonSets](daemonsets.md). Every type belongs to one, and the group plus a version make up the `apiVersion` field of every object ([API groups and versioning](https://kubernetes.io/docs/concepts/overview/kubernetes-api/#api-groups-and-versioning)).

- The **core group** has no name. Its objects have `apiVersion: v1`, and it holds the oldest types: pods, services, secrets, configmaps, namespaces, nodes, persistentvolumes and serviceaccounts.
- **Named groups** appear before the version. Deployments are `apps/v1`, [Roles](rbac.md#the-model) are `rbac.authorization.k8s.io/v1` and Ingresses are `networking.k8s.io/v1` ([API groups](https://kubernetes.io/docs/reference/using-api/#api-groups)).

## Where the group matters

In [RBAC](rbac.md), a rule names its groups in `apiGroups`, and the core group is written `""`. A rule for `deployments` in `""` matches nothing, because Deployments are in `apps`.

`kubectl create role` and `kubectl create clusterrole` look up the group for you, so `--resource=deployments` writes `apiGroups: ["apps"]`. The mistake happens in YAML written by hand:

```yaml
rules:
- apiGroups: [""]          # wrong: matches nothing for deployments
  resources: ["deployments"]
  verbs: ["list"]
```

A Forbidden message names the group the request needed:

```
cannot list resource "deployments" in API group "apps" in the namespace "dev"
```

`in API group ""` means the core group. It does not mean a value is missing.

## Finding a type's group

`kubectl api-resources` prints every type with its group and version in the `APIVERSION` column:

```bash
kubectl api-resources | grep -E '^(NAME|pods|deployments|roles) '
```

The output is similar to this:

```
NAME                                SHORTNAMES   APIVERSION                        NAMESPACED   KIND
pods                                po           v1                                true         Pod
deployments                         deploy       apps/v1                           true         Deployment
roles                                            rbac.authorization.k8s.io/v1      true         Role
```

`kubectl explain <type>` shows the same group and version at the top of its output.

## Failure modes

| Symptom | Cause |
| --- | --- |
| A Role for `deployments` exists, and the Forbidden message says `API group "apps"` | The rule's `apiGroups` is `[""]`. Change it to `["apps"]`. |
| `no matches for kind "Deployment" in version "v1"` | The [manifest](kubectl.md#generating-yaml)'s `apiVersion` is missing the group. It must be `apps/v1`. |

## Docs

- [The Kubernetes API](https://kubernetes.io/docs/concepts/overview/kubernetes-api/)
- [API overview](https://kubernetes.io/docs/reference/using-api/)
- [Referring to resources in RBAC](https://kubernetes.io/docs/reference/access-authn-authz/rbac/#referring-to-resources)
