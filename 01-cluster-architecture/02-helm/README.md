# Helm

[Helm](../../references/helm.md) installs a packaged application, called a [chart](../../references/helm.md#charts-repositories-and-releases), into a cluster as a named release, and
keeps a numbered history of that release so it can be upgraded, rolled back and uninstalled as
one unit. [How Helm works](../../learn/helm.md) explains what happens during an install.

<!-- lab: helm -->

You log in to `base`, which has no `kubectl`. From there you can `ssh` to `controlplane` and the two workers, `node01` and `node02`, which make up a working cluster with [Flannel](../../references/pod-network.md#plugins) as its pod network. Helm is installed on `controlplane`, and one release is already installed. Every command runs on `controlplane`.

## Objectives

* Add a chart repository and find a chart and its versions in it.
* Read the values a chart accepts before installing it.
* Install a pinned chart version into a new namespace with a value overridden.
* Find the objects and the release record an install creates.
* Upgrade a release, and keep the values it already had.
* Roll a release back to an earlier revision.
* Render a chart to a file without installing it.
* Uninstall a release.

## Find a chart

A [chart](../../references/helm.md#charts-repositories-and-releases) is a package of Kubernetes [manifests](../../references/kubectl.md#generating-yaml), and a repository is a web server that lists
charts and their versions.

1. Check that Helm reaches the cluster. It reads the same kubeconfig as `kubectl`
   ([kubeconfig](../../references/kubeconfig.md)). `helm list` prints the releases installed in a namespace:

   ```shell
   helm list -A
   ```

   Each row is one installed release, with the chart and revision it is on:

   ```
   NAME  	NAMESPACE	REVISION	UPDATED                               	STATUS  	CHART         	APP VERSION
   legacy	legacy   	1       	2026-09-27 20:01:31.39597267 -0400 EDT	deployed	podinfo-6.14.0	6.14.0
   ```

   `-A` means all namespaces, as it does for `kubectl`. One release, `legacy`, is already
   installed.

2. Add a repository under a local name and download its index. `helm repo add podinfo
   <url>` saves the repository's address under the name `podinfo`, and `helm repo update`
   downloads the list of charts and versions from every repository added:

   ```shell
   helm repo add podinfo https://stefanprodan.github.io/podinfo
   helm repo update
   ```

   `podinfo` is now a name on this machine only. Charts in the repository are referred to as
   `podinfo/<chart>`.

3. Search the repository, then list every version of the chart. `helm search repo podinfo`
   looks through the downloaded lists for charts named or described with `podinfo`, and
   `| head -4` keeps the header and the three newest versions:

   ```shell
   helm search repo podinfo
   helm search repo podinfo --versions | head -4
   ```

   The first search shows only the newest version; `--versions` lists the older ones too:

   ```
   NAME           	CHART VERSION	APP VERSION	DESCRIPTION
   podinfo/podinfo	6.15.0       	6.15.0     	Podinfo Helm chart for Kubernetes
   NAME           	CHART VERSION	APP VERSION	DESCRIPTION
   podinfo/podinfo	6.15.0       	6.15.0     	Podinfo Helm chart for Kubernetes
   podinfo/podinfo	6.14.1       	6.14.1     	Podinfo Helm chart for Kubernetes
   podinfo/podinfo	6.14.0       	6.14.0     	Podinfo Helm chart for Kubernetes
   ```

   `CHART VERSION` is the version of the package, and it is what `--version` selects.
   `APP VERSION` is the version of the software inside it.

## Read the values

A chart's templates read settings from its [values](../../references/helm.md#values), and a default for each value ships in the
chart.

1. Print the defaults. `helm show values` prints the chart's `values.yaml` file, and
   `| head -20` keeps its first 20 lines:

   ```shell
   helm show values podinfo/podinfo | head -20
   ```

   These are the chart's defaults, the settings a release gets when you change nothing:

   ```
   # Default values for podinfo.

   replicaCount: 1
   logLevel: info
   host: #0.0.0.0
   backend: #http://backend-podinfo:9898/echo
   backends: []

   image:
     repository: ghcr.io/stefanprodan/podinfo
     tag: 6.15.0
     pullPolicy: IfNotPresent
     pullSecrets: []

   prefix: /

   ui:
     color: "#34577c"
     message: ""
     logo: ""
   ```

   Each key is a value you can override. A nested key is written with dots on the command
   line, so `ui.message` sets `message` under `ui`.

## Install a release

A [release](../../references/helm.md#charts-repositories-and-releases) is one installed copy of a chart, with its own name, in one namespace.

1. Install version 6.14.1 as the release `web` in a new namespace `apps`, with 2 replicas.
   `helm install` takes the release name, `web`, then the chart, `podinfo/podinfo`.
   `--version 6.14.1` pins the chart version, `-n apps` is the namespace, `--create-namespace`
   creates it if it does not exist, and `--set replicaCount=2` overrides one value:

   ```shell
   helm install web podinfo/podinfo --version 6.14.1 -n apps --create-namespace --set replicaCount=2
   ```

   Without `--create-namespace`, the install fails with
   `Error: INSTALLATION FAILED: create: failed to create: namespaces "apps" not found`.

2. List releases in the namespace `apps`, then without `-n`:

   ```shell
   helm list -n apps
   helm list
   ```

   The first list has `web`; the second has only its header line:

   ```
   NAME	NAMESPACE	REVISION	UPDATED                                	STATUS  	CHART         	APP VERSION
   web 	apps     	1       	2026-09-27 18:30:41.658550901 -0400 EDT	deployed	podinfo-6.14.1	6.14.1
   NAME	NAMESPACE	REVISION	UPDATED	STATUS	CHART	APP VERSION
   ```

   A release lives in a [namespace](../../references/namespaces.md), and `helm` without `-n` looks only in the kubeconfig's
   current namespace, `default` here, so the second list is empty.

3. See what the chart created. `get deploy,svc,secrets` lists three types in one command,
   separated by commas:

   ```shell
   kubectl get deploy,svc,secrets -n apps
   ```

   The release made three objects:

   ```
   NAME                          READY   UP-TO-DATE   AVAILABLE   AGE
   deployment.apps/web-podinfo   2/2     2            2           2s

   NAME                  TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)             AGE
   service/web-podinfo   ClusterIP   10.99.174.71   <none>        9898/TCP,9999/TCP   2s

   NAME                               TYPE                 DATA   AGE
   secret/sh.helm.release.v1.web.v1   helm.sh/release.v1   1      2s
   ```

   The [Deployment](../../references/workloads.md) and [Service](../../references/services.md) are named after the release. The [Secret](../../references/config.md#secrets)
   `sh.helm.release.v1.web.v1` is Helm's record of revision 1, holding the chart and the values
   used. Helm runs only as a command-line tool, and these Secrets are the only place a release
   [is stored](../../references/helm.md#revisions-and-where-releases-are-stored).

4. Read back the values the release was installed with. `helm get values` prints the values
   stored with a release:

   ```shell
   helm get values web -n apps
   ```

   The release remembers the one value you set:

   ```
   USER-SUPPLIED VALUES:
   replicaCount: 2
   ```

   Only the overrides are shown. `--all` adds every default as well.

## Upgrade a release

`helm upgrade` installs a new chart version, new values, or both, as the next [revision](../../references/helm.md#revisions-and-where-releases-are-stored) of the
same release.

1. Put the new value in a file. Its keys have the same nesting as `helm show values` prints, so
   `vim web-values.yaml` and write:

   ```yaml
   ui:
     message: hello from helm
   ```

   Then upgrade to version 6.15.0 with it. `helm upgrade` takes the same release name and
   chart as `install`, and `-f web-values.yaml` reads values from the file, where `--set`
   takes one on the command line:

   ```shell
   helm upgrade web podinfo/podinfo --version 6.15.0 -n apps -f web-values.yaml
   ```

2. Check the values and the replica count:

   ```shell
   helm get values web -n apps
   kubectl get deploy web-podinfo -n apps
   ```

   Only the new value is stored, and the Deployment has one pod:

   ```
   USER-SUPPLIED VALUES:
   ui:
     message: hello from helm
   NAME          READY   UP-TO-DATE   AVAILABLE   AGE
   web-podinfo   0/1     1            0           3s
   ```

   `replicaCount: 2` is gone and the Deployment is back to the chart's default of 1. An
   upgrade given `-f` or `--set` starts again from the chart's defaults and applies only the
   [values](../../references/helm.md#values) on that command line.

3. Upgrade again with `--reuse-values`, which keeps the release's current values and merges
   the new ones on top:

   ```shell
   helm upgrade web podinfo/podinfo -n apps --reuse-values --set replicaCount=3
   helm get values web -n apps
   ```

   Both values are stored now:

   ```
   USER-SUPPLIED VALUES:
   replicaCount: 3
   ui:
     message: hello from helm
   ```

   Without `--version`, `helm upgrade` takes the newest chart version in the repository.

## Roll back

1. List the revisions. `helm history` prints every revision of a release, oldest first:

   ```shell
   helm history web -n apps
   ```

   Each install or upgrade added a revision, with the chart version it used:

   ```
   REVISION	UPDATED                 	STATUS    	CHART         	APP VERSION	DESCRIPTION
   1       	Sun Sep 27 18:31:07 2026	superseded	podinfo-6.14.1	6.14.1     	Install complete
   2       	Sun Sep 27 18:31:10 2026	superseded	podinfo-6.15.0	6.15.0     	Upgrade complete
   3       	Sun Sep 27 18:31:10 2026	deployed  	podinfo-6.15.0	6.15.0     	Upgrade complete
   ```

   One revision is `deployed`, and every earlier one is `superseded`.

2. Roll back to revision 1 and list again. `helm rollback web 1` takes the release name, then
   the revision to go back to:

   ```shell
   helm rollback web 1 -n apps
   helm history web -n apps
   ```

   There is a new revision at the bottom, described as `Rollback to 1`:

   ```
   REVISION	UPDATED                 	STATUS    	CHART         	APP VERSION	DESCRIPTION
   1       	Sun Sep 27 18:31:07 2026	superseded	podinfo-6.14.1	6.14.1     	Install complete
   2       	Sun Sep 27 18:31:10 2026	superseded	podinfo-6.15.0	6.15.0     	Upgrade complete
   3       	Sun Sep 27 18:31:10 2026	superseded	podinfo-6.15.0	6.15.0     	Upgrade complete
   4       	Sun Sep 27 18:31:19 2026	deployed  	podinfo-6.14.1	6.14.1     	Rollback to 1
   ```

   A rollback does not remove [revisions](../../references/helm.md#revisions-and-where-releases-are-stored) 2 and 3. It writes revision 4 with the chart and
   values of revision 1.

3. Confirm the cluster matches revision 1. `-o jsonpath` prints only the replica count and
   the first container's image:

   ```shell
   kubectl get deploy web-podinfo -n apps -o jsonpath='{.spec.replicas} {.spec.template.spec.containers[0].image}{"\n"}'
   ```

   The Deployment is back to revision 1's settings, 2 replicas of image 6.14.1:

   ```
   2 ghcr.io/stefanprodan/podinfo:6.14.1
   ```

   The `ui.message` from revision 2 is gone too, because revision 1 never had it.

## Render without installing

[`helm template`](../../references/helm.md#rendering-without-installing) renders a chart's manifests on the local machine and prints them, without
installing anything.

1. Render version 6.15.0 to a file and list the kinds in it. `helm template` takes the same
   release name, chart and flags as `helm install`. `> web.yaml` writes the result to a file,
   and `grep '^kind:'` prints the lines that start with `kind:`:

   ```shell
   helm template web podinfo/podinfo --version 6.15.0 -n apps --set replicaCount=2 > web.yaml
   grep '^kind:' web.yaml
   ```

   The file holds one object per `kind:` line:

   ```
   kind: Service
   kind: Deployment
   kind: Pod
   kind: Pod
   kind: Pod
   ```

   The three [Pods](../../references/pod.md) come from the chart's `templates/tests/` folder. They run only when someone
   runs `helm test`, and `--skip-tests` leaves them out of the file.

2. Render again without them, using `--skip-tests`:

   ```shell
   helm template web podinfo/podinfo --version 6.15.0 -n apps --set replicaCount=2 --skip-tests | grep '^kind:'
   ```

   Only the Service and the Deployment are left:

   ```
   kind: Service
   kind: Deployment
   ```

   Applying this file with `kubectl apply -f` creates the objects but no release, so
   `helm list` would not show them.

## Uninstall

1. Uninstall the release and check what is left. `helm uninstall web` deletes the release and
   every object it created. `kubectl get ns apps` shows whether the namespace still exists:

   ```shell
   helm uninstall web -n apps
   helm list -n apps
   kubectl get secrets -n apps
   kubectl get ns apps
   ```

   The release, its objects and its Secrets are gone, but the namespace is still `Active`:

   ```
   release "web" uninstalled
   NAME	NAMESPACE	REVISION	UPDATED	STATUS	CHART	APP VERSION
   No resources found in apps namespace.
   NAME   STATUS   AGE
   apps   Active   21s
   ```

   Every object the release created is deleted, along with the Secrets for all four
   [revisions](../../references/helm.md#revisions-and-where-releases-are-stored). The namespace stays, because `--create-namespace` made it outside the release.

## Quiz

<details><summary>Which flag installs a specific chart version, and which version do you get without it?</summary>

`--version`. Without it, `helm install` and `helm upgrade` both take the newest version in the
repository index.
</details>

<details><summary>You upgrade with `--set image.tag=x` and the replica count you set at install goes back to the default. Why, and what prevents it?</summary>

An upgrade given `-f` or `--set` starts from the chart's defaults and applies only the values on
that command line. `--reuse-values` keeps the release's current values and merges the new ones
on top.
</details>

<details><summary>`helm list` shows nothing, but the application's pods are running. What are the two likely reasons?</summary>

The release is in another namespace, so run `helm list -A`. Or the objects were created with
`helm template` and `kubectl apply`, which leaves no release.
</details>

<details><summary>Where does Helm keep a release's history?</summary>

In one Secret per revision, of type `helm.sh/release.v1`, named
`sh.helm.release.v1.<release>.v<revision>`, in the release's namespace.
</details>

<details><summary>After `helm rollback web 1` on a release at revision 3, what does `helm history` show?</summary>

Four revisions. The rollback adds revision 4 with revision 1's chart and values, and revisions 2
and 3 stay as `superseded`.
</details>

<details><summary>How do you see the values a release was installed with?</summary>

`helm get values <release> -n <ns>` for the overrides, and add `--all` for every value
including the defaults.
</details>

<details><summary>Does `helm uninstall` delete a namespace made by `--create-namespace`?</summary>

No. The namespace is not part of the release, so it stays.
</details>

## Practice

Do it again without the steps, in **15 minutes**.

1. **Host `controlplane`, weight 20%.** Add the chart repository
   `https://stefanprodan.github.io/podinfo` under the name `podinfo`. Install the chart
   `podinfo/podinfo` at chart version `6.14.1` as the release `shop` in the namespace `store`,
   which does not exist yet, with 3 replicas.
2. **Host `controlplane`, weight 25%.** Upgrade `shop` to chart version `6.15.0` and set
   `ui.message` to `sale`. The release must keep 3 replicas.
3. **Host `controlplane`, weight 20%.** Roll `shop` back to the revision that ran chart
   version `6.14.1`.
4. **Host `controlplane`, weight 20%.** Write the manifests that chart version `6.15.0` of
   `podinfo/podinfo` would create for a release `preview` in `store` to `~/preview.yaml`,
   without the chart's test pods. Do not install it.
5. **Host `controlplane`, weight 15%.** A release of chart version `6.14.0` of [podinfo](../../references/helm.md#podinfo) is
   installed somewhere in the cluster. Uninstall it, and leave its namespace in place.

<details><summary>Solution</summary>

```shell
ssh controlplane
# 1.
helm repo add podinfo https://stefanprodan.github.io/podinfo
helm install shop podinfo/podinfo --version 6.14.1 -n store --create-namespace --set replicaCount=3

# 2. --reuse-values keeps replicaCount=3
helm upgrade shop podinfo/podinfo --version 6.15.0 -n store --reuse-values --set ui.message=sale

# 3. revision 1 is the install
helm history shop -n store
helm rollback shop 1 -n store

# 4.
helm template preview podinfo/podinfo --version 6.15.0 -n store --skip-tests > ~/preview.yaml

# 5. find it in every namespace; uninstall never deletes the namespace
helm list -A
helm uninstall legacy -n legacy
```

</details>

## Check your work

On `controlplane`:

1. `shop` is back on chart version 6.14.1 with 3 replicas, and `legacy` is gone:

   ```shell
   helm list -A
   kubectl get deploy shop-podinfo -n store -o jsonpath='{.spec.replicas} {.spec.template.spec.containers[0].image}{"\n"}'
   ```

   ```
   NAME	NAMESPACE	REVISION	UPDATED                                	STATUS  	CHART         	APP VERSION
   shop	store    	3       	2026-09-27 20:02:25.936142095 -0400 EDT	deployed	podinfo-6.14.1	6.14.1
   3 ghcr.io/stefanprodan/podinfo:6.14.1
   ```

2. The rendered file holds only the Service and the Deployment:

   ```shell
   grep '^kind:' ~/preview.yaml
   ```

   ```
   kind: Service
   kind: Deployment
   ```

## Further reading

* The [Helm](../../references/helm.md) reference has the model, where releases are stored, and the error
  messages in one place.
* [Using Helm](https://helm.sh/docs/intro/using_helm/) covers `--set` syntax for lists and
  nested keys, and the other install sources: a local folder, a `.tgz` and a URL.
* [Use OCI-based registries](https://helm.sh/docs/topics/registries/) covers installing charts
  from an `oci://` address instead of a repository.
* [Custom Resource Definitions](https://helm.sh/docs/topics/charts/#custom-resource-definitions-crds)
  explains how a chart installs [CRDs](../../references/crds.md) and why Helm never upgrades or deletes them.
  [CRDs and Operators](../04-crds-operators/README.md) builds on it.
