# Kustomize

Kustomize builds a set of [manifests](kubectl.md#generating-yaml) from plain YAML files and a `kustomization.yaml` that lists them and the changes to make. It has no templates: the input files are valid Kubernetes objects, and the changes are written as fields and patches ([overview of Kustomize](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/#overview-of-kustomize)). Kustomize is built into `kubectl`.

[How Kustomize works](../learn/kustomize.md) explains bases and overlays and compares Kustomize with [Helm](helm.md).

## Bases and overlays

A kustomization is a folder with a `kustomization.yaml`. Its `resources` lists manifest files and other kustomization folders ([bases and overlays](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/#bases-and-overlays)):

- A **base** lists manifests and is complete on its own.
- An **overlay** lists a base, usually as `../../base`, and changes what the base produces. Several overlays, such as `dev` and `prod`, can share one base.

The base files are never edited by an overlay. Everything is applied when the overlay is built.

## What an overlay can set

These fields change every object, or one named object, without a patch ([setting cross-cutting fields](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/#setting-cross-cutting-fields)):

| Field | What it changes |
| --- | --- |
| `namespace` | Sets `metadata.namespace` on every namespaced object. It does not create the namespace. |
| `namePrefix`, `nameSuffix` | Adds to every object's name, and rewrites references to those names, such as a [Deployment](workloads.md)'s reference to a [ConfigMap](config.md). |
| `labels` | Adds [labels](labels.md). See [labels](#labels) below. |
| `images` | Changes the tag, digest or name of every container that uses the named image ([customizing](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/#customizing)). |
| `replicas` | Sets the replica count of the named Deployment, [ReplicaSet](workloads.md#deployments-and-replicasets) or [StatefulSet](workloads.md#other-workload-kinds). The allowed docs do not describe it, so use the `increase_replicas.yaml` patch from [customizing](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/#customizing) instead. |

`images` and `replicas` name their target as the base does: the image `nginx`, the Deployment `web`, not `prod-web`.

Every field above has a copyable example on the allowed Kustomize page except `replicas`. Search kubernetes.io for `kustomize` to reach it.

## Labels

The `labels` field adds labels to each object's own `metadata.labels` only ([Kustomize feature list](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/#kustomize-feature-list)). Two flags widen it ([labels](https://kubectl.docs.kubernetes.io/references/kustomize/kustomization/labels/) (not available in the exam)):

- `includeTemplates: true` also adds them to the [pod template](workloads.md#the-pod-template), so the pods carry them.
- `includeSelectors: true` adds them to the pod template and to selectors.

With `env: prod` and neither flag, `kubectl get deploy -l env=prod` finds the Deployment, and `kubectl get pods -l env=prod` finds none of its pods. A Deployment's selector cannot be changed after it is created, so turning on `includeSelectors` for a Deployment that already exists fails with `spec.selector: … field is immutable`. `commonLabels`, which older examples use, behaves like `includeSelectors: true` and is deprecated.

## Patches

A patch is a partial manifest with the `apiVersion`, `kind` and `metadata.name` of the object it changes, and only the fields to add or replace ([customizing](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/#customizing)). It uses the base's name for the object. This kind of patch is a strategic merge patch, which is merged into the object field by field. Lists of containers are matched by each container's `name`, so a patch that names `nginx` and sets `resources` keeps the rest of that container:

```yaml
patches:
- path: resources-patch.yaml
```

## Generated names

`configMapGenerator` and `secretGenerator` write a ConfigMap or a [Secret](config.md#secrets) from literals or files ([generating resources](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/#generating-resources)). A [ConfigMap](https://kubernetes.io/docs/concepts/configuration/configmap/) holds key-value settings that a pod can read as environment variables or files.

Kustomize adds a hash of the contents to the generated name, such as `web-config-f655md8fbd`, and rewrites every reference to `web-config` in the same build ([generatorOptions](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/#generatoroptions)). When the contents change, the name changes, the Deployment's pod template changes with it, and the Deployment replaces its pods. A ConfigMap changed in place does not update the environment variables of running pods ([mounted ConfigMaps are updated automatically](https://kubernetes.io/docs/concepts/configuration/configmap/#mounted-configmaps-are-updated-automatically)).

`kubectl apply` never deletes, so each change leaves the previous ConfigMap in the namespace.

## `-f` and `-k`

| Command | What it does |
| --- | --- |
| `kubectl kustomize <dir>` | Prints the built manifests. Nothing is sent to the cluster. |
| `kubectl apply -k <dir>` | Builds, then applies ([how to apply, view and delete objects](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/#how-to-apply-view-delete-objects-using-kustomize)). |
| `kubectl diff -k <dir>` | Builds, then shows what would change in the cluster. |
| `kubectl delete -k <dir>` | Builds, then deletes what the build produces now. |
| `kubectl apply -f <dir>` | Applies every YAML file in the folder as-is and does not run Kustomize. |

`kubectl kustomize` and every `-k` command also accept a Git URL, such as a project's `config/` folder at a tag ([kubectl kustomize](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_kustomize/)).

## Commands

```bash
kubectl kustomize overlays/prod                   # print the result
kubectl kustomize overlays/prod > out.yaml        # save it
kubectl apply -k overlays/prod
kubectl diff -k overlays/prod                     # what apply would change
kubectl delete -k overlays/prod
kubectl create namespace prod --dry-run=client -o yaml > overlays/prod/namespace.yaml
kubectl create deployment web --image=nginx:1.27 --dry-run=client -o yaml > base/deployment.yaml
```

## Failure modes

| Symptom | Cause |
| --- | --- |
| `error: unable to find one of 'kustomization.yaml', 'kustomization.yml' or 'Kustomization' in directory …` | The folder given to `kustomize` or `-k` has no kustomization file. |
| `error validating "base/kustomization.yaml": error validating data: [apiVersion not set, kind not set]` | `kubectl apply -f` was run on a kustomization folder. Use `-k`. The other files in the folder were applied before the error. |
| `Error from server (NotFound): error when creating "overlays/prod": namespaces "prod" not found` | `namespace:` does not create the namespace. Add a [Namespace](namespaces.md) manifest to `resources`. |
| `kubectl get pods -l <label>` finds nothing after adding `labels` | The label is on the Deployment only. Add `includeTemplates: true`. |
| `error: no resource matches strategic merge patch "Deployment.v1.apps/prod-web.[noNs]"` | The patch names the object with the overlay's prefix. Use the base's name. |
| Old `…-config-<hash>` ConfigMaps pile up | Each content change creates a new one, and `apply` never deletes. |

## Docs

- [Declarative Management of Kubernetes Objects Using Kustomize](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/)
- [kubectl kustomize](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_kustomize/)
- [The kustomization field reference](https://kubectl.docs.kubernetes.io/references/kustomize/kustomization/) (not available in the exam)
