# Helm

Helm is a package manager for Kubernetes. It installs a [chart](#charts-repositories-and-releases), which is a package of templated [manifests](kubectl.md#generating-yaml), into a cluster as a release, and keeps a numbered revision for every change to it. [How Helm works](../learn/helm.md) explains the model.

## Charts, repositories and releases

Helm works with three things ([key components](https://helm.sh/docs/intro/introduction/#key-components)), and the names are easy to mix up:

| Thing | What it is | How you refer to it |
| --- | --- | --- |
| [Chart](https://helm.sh/docs/intro/introduction/#chart) | A package: templates, default values, and a `Chart.yaml` with its version. | `<repo>/<chart>`, such as `podinfo/podinfo` ([podinfo](#podinfo)), or a folder, a `.tgz` file (a packaged chart) or an `oci://` address. |
| [Repository](https://helm.sh/docs/intro/introduction/#repository) | A web server with an `index.yaml` listing charts and their versions. | The local name given in `helm repo add`. The name exists only on the machine that added it. |
| [Release](https://helm.sh/docs/intro/introduction/#release) | One installed copy of a chart, with its own name, in one namespace. | Its release name plus `-n <namespace>`. |

OCI (Open Container Initiative) is the standard for container images and the registries that store them. A chart can be stored in such a registry next to images and installed straight from it with an `oci://` address, with no `helm repo add`.

One chart can be installed many times in the same cluster, and each install is a separate release with its own name.

A chart has two version numbers ([charts and versioning](https://helm.sh/docs/topics/charts/#charts-and-versioning), [the appVersion field](https://helm.sh/docs/topics/charts/#the-appversion-field)). `version` is the version of the package, and it is what `--version` selects. `appVersion` is the version of the application inside it, for information only. `helm search repo` prints them as `CHART VERSION` and `APP VERSION`.

## Values

A chart's templates read their settings from values ([values files](https://helm.sh/docs/topics/charts/#values-files)). The chart ships a default for each in `values.yaml`, which `helm show values <chart>` prints. At install or upgrade, you override them in two ways ([customizing the chart before installing](https://helm.sh/docs/intro/using_helm/#customizing-the-chart-before-installing)):

- `-f <file>` reads overrides from a YAML file. When given more than once, the rightmost file wins.
- `--set key=value` sets one value on the command line, with dots for nested keys, such as `--set ui.message=hi`. `--set` wins over `-f`.

On an upgrade, values given with `-f` or `--set` start again from the chart's defaults, so every override from earlier revisions is dropped. A release installed with `--set replicaCount=2` goes back to the chart's 1 replica after `helm upgrade -f web-values.yaml`. `--reuse-values` keeps the release's current values and merges the new ones on top ([helm upgrade options](https://helm.sh/docs/helm/helm_upgrade/#options)).

`helm get values <release>` prints the overrides a release was given, and `--all` adds the defaults.

## Revisions and where releases are stored

Every install, upgrade and rollback adds a revision, starting at 1 ([helm upgrade and helm rollback](https://helm.sh/docs/intro/using_helm/#helm-upgrade-and-helm-rollback-upgrading-a-release-and-recovering-on-failure)). A rollback does not delete later revisions. It writes a new revision with the chart and values of the one named. The newest revision is `deployed`, and the ones before it are `superseded`.

Helm runs only as a command-line tool that talks to the [apiserver](control-plane.md#components) ([architecture](https://helm.sh/docs/intro/introduction/#architecture)), and it reads the same kubeconfig as `kubectl` ([kubeconfig](kubeconfig.md)). By default, it stores each revision as a [Secret](config.md#secrets) in the release's namespace ([storage backends](https://helm.sh/docs/topics/advanced/#storage-backends)), so the Secrets are the release. `helm uninstall` deletes the release's objects and all its Secrets ([helm uninstall](https://helm.sh/docs/intro/using_helm/#helm-uninstall-uninstalling-a-release)).

A release belongs to one namespace ([namespaces](namespaces.md)). Every `helm` command without `-n` uses the kubeconfig's current namespace, usually `default`.

## Rendering without installing

`helm template` renders a chart on the local machine and prints the manifests ([helm template](https://helm.sh/docs/helm/helm_template/)). Nothing is installed and no release is recorded, so objects created by piping its output to `kubectl apply` do not appear in `helm list` and cannot be upgraded or rolled back with Helm.

A chart's test pods, in `templates/tests/`, are part of the output unless `--skip-tests` is given. They run only when someone runs `helm test` ([chart tests](https://helm.sh/docs/topics/chart_tests/)).

## Custom resource definitions

A chart installs the [CustomResourceDefinitions](crds.md) (CRDs) in its `crds/` folder before anything else, and only on install ([custom resource definitions](https://helm.sh/docs/topics/charts/#custom-resource-definitions-crds)). Helm never upgrades or deletes a CRD, and skips one that already exists ([limitations on CRDs](https://helm.sh/docs/topics/charts/#limitations-on-crds)). `--skip-crds` installs the chart without them.

## podinfo

podinfo is a small demo web application with a small chart. A release of the podinfo chart creates a [Deployment](workloads.md), a [Service](services.md) and one Secret per revision:

```
NAME                          READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/web-podinfo   2/2     2            2           2s

NAME                  TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)             AGE
service/web-podinfo   ClusterIP   10.99.174.71   <none>        9898/TCP,9999/TCP   2s

NAME                               TYPE                 DATA   AGE
secret/sh.helm.release.v1.web.v1   helm.sh/release.v1   1      2s
```

## Commands

```bash
helm repo add podinfo https://stefanprodan.github.io/podinfo
helm repo update                                   # download every repository's index again
helm search repo podinfo --versions                # every chart version in the added repositories
helm show values podinfo/podinfo                   # the chart's defaults
helm install web podinfo/podinfo --version 6.14.1 -n apps --create-namespace --set replicaCount=2
helm upgrade --install web podinfo/podinfo -n apps # install if missing, upgrade if present
helm upgrade web podinfo/podinfo -n apps --reuse-values --set ui.message=hi
helm list -A                                       # releases in every namespace
helm history web -n apps
helm rollback web 1 -n apps
helm get values web -n apps                        # overrides; --all adds the defaults
helm get manifest web -n apps                      # the manifests the current revision applied
helm template web podinfo/podinfo --skip-tests > web.yaml
helm uninstall web -n apps
```

## Failure modes

| Symptom | Cause |
| --- | --- |
| `Error: INSTALLATION FAILED: create: failed to create: namespaces "apps" not found` | The namespace does not exist. Add `--create-namespace`. |
| `Error: INSTALLATION FAILED: release name check failed: cannot reuse a name that is still in use` | A release with that name already exists in the namespace. Use `helm upgrade`, or `helm upgrade --install`. |
| `Error: release: not found` | The release is in another namespace. Add `-n <namespace>`, or find it with `helm list -A`. |
| `Error: INSTALLATION FAILED: repo nothere not found` | No repository has been added under that name on this machine. Run `helm repo add`. |
| `Error: chart "podinfo" matching 9.9.9 not found in podinfo index. (try 'helm repo update')` | That chart version is not in the downloaded index. Run `helm repo update`, then check the version with `helm search repo <chart> --versions`. |
| `Error: release has no 9 version` | `helm rollback` was given a revision that does not exist. Check `helm history`. |
| Values set at install are gone after an upgrade | The upgrade used `-f` or `--set` without `--reuse-values`. |

## Docs

- [Introduction to Helm](https://helm.sh/docs/intro/introduction/)
- [Using Helm](https://helm.sh/docs/intro/using_helm/)
- [Cheat sheet](https://helm.sh/docs/intro/cheatsheet/)
- [Charts](https://helm.sh/docs/topics/charts/)
- [helm upgrade](https://helm.sh/docs/helm/helm_upgrade/)
