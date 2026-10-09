# Kustomize

[Kustomize](../../references/kustomize.md) builds a final set of [manifests](../../references/kubectl.md#generating-yaml) from plain YAML files plus a `kustomization.yaml` that
lists them and the changes to make, such as a namespace, a name prefix or an image tag. It is
built into `kubectl`, so no template language and no extra tool is involved.
[How Kustomize works](../../learn/kustomize.md) explains bases, overlays and generated names.

<!-- lab: kustomize -->

You log in to `base`, which has no `kubectl`. From there you can `ssh` to `controlplane` and the two workers, `node01` and `node02`, which make up a working cluster with [Flannel](../../references/pod-network.md#plugins) as its pod network. Every command runs on `controlplane`.

## Objectives

* Turn generated manifests into a Kustomize base, using the kustomization the docs give you.
* Preview what Kustomize produces before anything reaches the cluster.
* Write an overlay that changes the base's namespace, names, [labels](../../references/labels.md) and image tag.
* Change fields in one object with patches copied from the docs.
* Generate a [ConfigMap](../../references/config.md) whose name changes with its contents, and watch the [Deployment](../../references/workloads.md) roll.
* Apply and delete everything a kustomization produces with `-k`.

Every YAML file in the steps comes from `kubectl create --dry-run` or from the allowed docs.
The Kustomize snippets are all on one page,
[Declarative Management of Kubernetes Objects Using Kustomize](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/),
found by searching kubernetes.io for `kustomize`. Its examples are `cat <<EOF` blocks you can
[paste straight into the terminal](../../references/kubectl.md#snippets-from-the-docs).

## Write a base

A [base](../../references/kustomize.md#bases-and-overlays) is a folder of ordinary manifests with a `kustomization.yaml` that lists them.

1. Make the folder and generate a Deployment and a [Service](../../references/services.md) into it. `mkdir -p ~/web/base` creates
   `base` and its parent `web`, and `cd ~/web` moves into it. `create service clusterip web`
   makes a Service named `web` that is reachable only inside the cluster, and `--tcp=80:80` is
   the Service's port, then the pods' port:

   ```shell
   mkdir -p ~/web/base && cd ~/web
   k create deployment web --image=nginx:1.27 --dry-run=client -o yaml > base/deployment.yaml
   k create service clusterip web --tcp=80:80 --dry-run=client -o yaml > base/service.yaml
   ```

   The Deployment labels its pods `app: web`, which is the selector [`k create service`](../../references/kubectl.md#generating-yaml) writes
   for a Service named `web`.

2. Ask Kustomize to build the folder. `k kustomize base` reads the kustomization in `base`
   and prints the manifests it produces:

   ```shell
   k kustomize base
   ```

   Kustomize looks for its file and stops:

   ```
   error: unable to find one of 'kustomization.yaml', 'kustomization.yml' or 'Kustomization' in directory '/home/candidate/web/base'
   ```

   A folder of manifests is not a kustomization until it has that file.

3. On the Kustomize page, go to
   [Bases and Overlays](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/#bases-and-overlays).
   The first example ends with a block that writes `base/kustomization.yaml`. Copy that block
   and paste it into the terminal as it is:

   ```shell
   # Create a base/kustomization.yaml
   cat <<EOF > base/kustomization.yaml
   resources:
   - deployment.yaml
   - service.yaml
   EOF
   ```

   `cat <<EOF > base/kustomization.yaml` writes every line up to `EOF` into the file.
   `resources` lists the manifest files the kustomization includes. The docs' file names match
   the ones you generated, so nothing needs changing.

4. Build again:

   ```shell
   k kustomize base
   ```

   [`k kustomize`](../../references/kustomize.md#commands) prints both objects and sends nothing to the cluster.

5. Apply the folder the way a plain folder of manifests is applied:

   ```shell
   k apply -f base/
   ```

   The two manifests are created, and `kustomization.yaml` fails because it is not an object:

   ```
   deployment.apps/web created
   service/web created
   error: error validating "base/kustomization.yaml": error validating data: [apiVersion not set, kind not set]; if you choose to ignore these errors, turn validation off with --validate=false
   ```

   `-f` reads every file in the folder as a manifest, including `kustomization.yaml`, and
   ignores what it says. [`-k`](../../references/kustomize.md#-f-and--k) is the flag that runs Kustomize.

6. Remove the two objects `-f` created. `delete -f` deletes the objects a file describes, and
   takes one `-f` per file:

   ```shell
   k delete -f base/deployment.yaml -f base/service.yaml
   ```

## Write an overlay

An [overlay](../../references/kustomize.md#bases-and-overlays) is a kustomization whose resources include another kustomization, the base, and
which changes what the base produces. The base files are never edited.

1. In the same Bases and Overlays section, copy the `prod` overlay block, paste it, and build
   it:

   ```shell
   mkdir prod
   cat <<EOF > prod/kustomization.yaml
   resources:
   - ../base
   namePrefix: prod-
   EOF
   k kustomize prod | grep -E '^kind|^  name:'
   ```

   Both objects now start with `prod-`:

   ```
   kind: Service
     name: prod-web
   kind: Deployment
     name: prod-web
   ```

   `- ../base` under `resources` includes the base folder's kustomization, and
   `namePrefix: prod-` puts `prod-` in front of every name. `grep -E '^kind|^  name:'` keeps the
   `kind` lines and each object's own `name`. The files in `base` are unchanged. The prefix
   exists only in what Kustomize prints.

2. Add a namespace, a label and a new image tag. Go to
   [Setting cross-cutting fields](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/#setting-cross-cutting-fields)
   for `namespace` and `labels`, and to
   [Customizing](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/#customizing)
   for `images`. Copy only those lines from the docs' `kustomization.yaml` blocks into
   `vim prod/kustomization.yaml`, with `:set paste` first, and change the values. The file now
   reads:

   ```yaml
   resources:
   - ../base
   namespace: prod
   namePrefix: prod-
   labels:
     - pairs:
         env: prod
   images:
   - name: nginx
     newTag: "1.28"
   ```

   `namespace: prod` puts every object in `prod`. `labels` with `pairs` adds `env: prod` to
   every object. `images` finds every container whose image is `nginx` and sets its tag to
   `newTag`, `1.28`. The docs' `labels` example also has `includeSelectors: true`. Leave it out: it would also
   change the Deployment's selector, which cannot change once the Deployment exists
   ([labels](../../references/kustomize.md#labels)).

3. Build the overlay:

   ```shell
   k kustomize prod
   ```

   Both objects carry the namespace `prod` and the label `env: prod`, and the Deployment runs
   `nginx:1.28`:

   ```
   apiVersion: v1
   kind: Service
   metadata:
     labels:
       app: web
       env: prod
     name: prod-web
     namespace: prod
   spec:
     ports:
     - name: 80-80
       port: 80
       protocol: TCP
       targetPort: 80
     selector:
       app: web
     type: ClusterIP
   status:
     loadBalancer: {}
   ---
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     labels:
       app: web
       env: prod
     name: prod-web
     namespace: prod
   spec:
     replicas: 1
     selector:
       matchLabels:
         app: web
     strategy: {}
     template:
       metadata:
         labels:
           app: web
       spec:
         containers:
         - image: nginx:1.28
           name: nginx
           resources: {}
   status: {}
   ```

   `images` names the image as the base does, `nginx`. The `env: prod` label went onto each
   object's own labels only, not into the selector or the [pod template](../../references/workloads.md#the-pod-template).
   [What an overlay can set](../../references/kustomize.md#what-an-overlay-can-set) lists the other fields.

4. Apply the overlay. `apply -k prod` builds the kustomization in `prod` and applies the
   result, as `apply -f` does with a file:

   ```shell
   k apply -k prod
   ```

   Both objects are refused:

   ```
   Error from server (NotFound): error when creating "prod": namespaces "prod" not found
   Error from server (NotFound): error when creating "prod": namespaces "prod" not found
   ```

   `namespace:` sets the namespace on every object but [does not create it](../../references/kustomize.md#failure-modes).

5. Generate a [Namespace](../../references/namespaces.md) manifest into the overlay, then add `- namespace.yaml` under
   `resources` in `vim prod/kustomization.yaml`:

   ```shell
   k create namespace prod --dry-run=client -o yaml > prod/namespace.yaml
   ```

## Patch fields

A [patch](../../references/kustomize.md#patches) is a partial manifest. It names the object it changes by kind and name, and holds only
the fields to add or replace.

1. The [Customizing](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/#customizing)
   section has two patch blocks, `increase_replicas.yaml` and `set_memory.yaml`. In `~/web/prod`,
   paste each block into the terminal, then fix the names in vim. The docs' Deployment is
   `my-nginx`, and so is its container. Yours is `web`, and its container is `nginx`. Set the
   memory limit to `128Mi`. The files read:

   ```yaml
   # prod/increase_replicas.yaml
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: web
   spec:
     replicas: 3
   ```

   ```yaml
   # prod/set_memory.yaml
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: web
   spec:
     template:
       spec:
         containers:
         - name: nginx
           resources:
             limits:
               memory: 128Mi
   ```

   `increase_replicas.yaml` sets `replicas` to 3. `set_memory.yaml` sets a memory limit of
   128 mebibytes on the container, the most memory it may use. A patch uses the base's name,
   `web`, not `prod-web`. The container is matched by its `name`.

2. In `vim prod/kustomization.yaml`, add the `patches` list from the same docs block. Each
   `path` names one patch file. The file now reads:

   ```yaml
   resources:
   - ../base
   - namespace.yaml
   namespace: prod
   namePrefix: prod-
   labels:
     - pairs:
         env: prod
   images:
   - name: nginx
     newTag: "1.28"
   patches:
     - path: increase_replicas.yaml
     - path: set_memory.yaml
   ```

3. Apply the overlay and check the Deployment. `-o jsonpath` prints the replica count, the
   image and the memory limit, the three things the overlay changed:

   ```shell
   cd ~/web
   k apply -k prod
   k rollout status deploy/prod-web -n prod
   k get deploy prod-web -n prod -o jsonpath='{.spec.replicas} {.spec.template.spec.containers[0].image} {.spec.template.spec.containers[0].resources.limits}{"\n"}'
   ```

   The live Deployment has every change the overlay made, the replica count, the image and the
   memory limit:

   ```
   3 nginx:1.28 {"memory":"128Mi"}
   ```

4. Select by the label the overlay added. `-l env=prod` lists only the objects that carry the
   label `env: prod`:

   ```shell
   k get deploy,pods -n prod -l env=prod
   ```

   Only the Deployment is listed:

   ```
   NAME                       READY   UP-TO-DATE   AVAILABLE   AGE
   deployment.apps/prod-web   3/3     3            3           1s
   ```

   The pods are missing, because the [label](../../references/kustomize.md#labels) was not added to the pod template. `-l app=web`
   finds them, because that [selector](../../references/labels.md#keys-and-values) matches the pod template's labels.

## Generate a ConfigMap

A ConfigMap holds key-value settings that a pod can read as environment variables.
`configMapGenerator` writes one and adds a [hash of its contents](../../references/kustomize.md#generated-names) to the name.

1. The second example in the
   [configMapGenerator](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/#configmapgenerator)
   section uses `literals`. Its block would overwrite the whole `kustomization.yaml`, so don't
   paste it into the terminal. Copy only its four `configMapGenerator` lines into the end of
   `vim base/kustomization.yaml`, and change the name and the value. `literals` lists the
   ConfigMap's keys as `KEY=value`:

   ```yaml
   configMapGenerator:
   - name: web-config
     literals:
     - GREETING=hello
   ```

2. Load it into the container. On
   [Configure a Pod to Use a ConfigMap](https://kubernetes.io/docs/tasks/configure-pod-container/configure-pod-configmap/#configure-all-key-value-pairs-in-a-configmap-as-container-environment-variables),
   the example file has an `envFrom` block. Copy it into `vim base/deployment.yaml`, below
   `resources: {}` and at the same indent, and change the name. `envFrom` with
   `configMapRef` turns every key in the ConfigMap into an environment variable in the
   container:

   ```yaml
           envFrom:
           - configMapRef:
               name: web-config
   ```

3. Build the overlay and find the ConfigMap's name. `grep web-config` keeps every line that
   mentions it:

   ```shell
   k kustomize prod | grep web-config
   ```

   The name appears twice, on the ConfigMap and inside the Deployment:

   ```
     name: prod-web-config-f655md8fbd
               name: prod-web-config-f655md8fbd
   ```

   The ConfigMap is `prod-web-config-f655md8fbd`, and the Deployment's reference to
   `web-config` was rewritten to the same name.

4. Apply it and read the variable in a pod. `k exec deploy/prod-web` runs a command in one of
   the Deployment's pods, and everything after `--` is that command. `printenv GREETING`
   prints the variable's value:

   ```shell
   k apply -k prod
   k rollout status deploy/prod-web -n prod
   k exec -n prod deploy/prod-web -- printenv GREETING
   ```

   The pod prints `hello`.

5. In `vim base/kustomization.yaml`, change `GREETING=hello` to `GREETING=hi`. Then see what
   would change in the cluster. `k diff -k prod` compares what the kustomization produces with
   what is in the cluster, and prints removed lines with `-` and new lines with `+`. The `grep`
   keeps the ConfigMap's name lines:

   ```shell
   k diff -k prod | grep -E '^[-+] +name: prod-web-config'
   ```

   The `-` line is the name in use now, and the `+` lines are the new one:

   ```
   -            name: prod-web-config-f655md8fbd
   +            name: prod-web-config-hc7d4825hb
   +  name: prod-web-config-hc7d4825hb
   ```

   New contents give a new name, and the new name changes the pod template, so the Deployment
   rolls out new pods. A ConfigMap edited in place would not update the running pods.

6. Apply the change:

   ```shell
   k apply -k prod
   k rollout status deploy/prod-web -n prod
   k exec -n prod deploy/prod-web -- printenv GREETING
   k get cm -n prod
   ```

   The pod prints the new value, and both ConfigMaps exist:

   ```
   hi
   NAME                         DATA   AGE
   kube-root-ca.crt             1      7s
   prod-web-config-f655md8fbd   1      5s
   prod-web-config-hc7d4825hb   1      2s
   ```

   The old ConfigMap is still there. `k apply` creates and updates, and never deletes an object
   the kustomization no longer produces.

## Delete everything

1. Delete what the overlay produces. `delete -k prod` builds the kustomization and deletes
   each object it produces:

   ```shell
   k delete -k prod
   ```

   `delete -k` deletes only what the kustomization renders now, which includes
   `prod-web-config-hc7d4825hb` but not the older ConfigMap. That one goes because its
   [namespace](../../references/namespaces.md) is deleted.

## Quiz

<details><summary>What is the difference between `k kustomize dir`, `k apply -k dir` and `k apply -f dir`?</summary>

`kustomize` prints the built manifests and changes nothing. `apply -k` builds and applies them.
`apply -f` applies every file in the folder as-is, and fails on `kustomization.yaml` because it
is not a Kubernetes object.
</details>

<details><summary>Where in the allowed docs are the Kustomize snippets, and what do you search for?</summary>

Search kubernetes.io for `kustomize` and open "Declarative Management of Kubernetes Objects Using
Kustomize". Bases and Overlays, Setting cross-cutting fields, Customizing and configMapGenerator
have the blocks.
</details>

<details><summary>A docs block starts with `cat <<EOF >./kustomization.yaml`. When is pasting it into the terminal wrong?</summary>

When the file already exists. The block replaces the whole file, so copy only the lines you need
into vim instead.
</details>

<details><summary>An overlay sets `namespace: prod` and `apply -k` fails with `namespaces "prod" not found`. Why?</summary>

`namespace:` only sets the field on each object. Add a Namespace manifest to the overlay's
resources, or create the namespace first.
</details>

<details><summary>A patch in an overlay with `namePrefix: prod-` targets a Deployment. Which name does the patch use?</summary>

The base's name, such as `web`. Naming `prod-web` fails with `no resource matches strategic merge
patch`.
</details>

<details><summary>Why does a generated ConfigMap get a hash suffix?</summary>

The name changes whenever the contents change, which changes every reference to it, so the
pods that use it are replaced and read the new values.
</details>

<details><summary>You add `labels` with `env: prod` in an overlay. Why does `k get pods -l env=prod` find nothing?</summary>

`labels` adds to each object's own labels only. `includeTemplates: true` also adds it to the pod
template. `includeSelectors: true` adds it to the pod template and the selectors.
</details>

## Practice

Do it again without the steps, in **15 minutes**.

1. **Host `controlplane`, weight 25%.** In `~/shop/base`, create a kustomization with a
   Deployment `shop` running `nginx:1.27`, and a [ClusterIP](../../references/services.md#service-types) Service `shop` on port 80 for it.
2. **Host `controlplane`, weight 30%.** In `~/shop/staging`, create an overlay of that base that
   puts everything in the namespace `staging`, which does not exist yet, prefixes every name
   with `staging-`, runs `nginx:1.28` and 2 replicas. Apply it.
3. **Host `controlplane`, weight 25%.** The kustomization in `/opt/course/3/overlay` should
   deploy `tools-api` with 2 replicas into the namespace `tools`, but it fails to apply. Fix it
   without changing anything in `/opt/course/3/base`, and apply it.
4. **Host `controlplane`, weight 20%.** In the `staging` overlay, generate a ConfigMap
   `shop-settings` with `MODE=staging` and load it into the `shop` container as environment
   variables. Apply it.

<details><summary>Solution</summary>

Task 1. Generate the manifests, then paste the base kustomization block from Bases and Overlays:

```shell
ssh controlplane
mkdir -p ~/shop/base ~/shop/staging && cd ~/shop
k create deployment shop --image=nginx:1.27 --dry-run=client -o yaml > base/deployment.yaml
k create service clusterip shop --tcp=80:80 --dry-run=client -o yaml > base/service.yaml
cat <<EOF > base/kustomization.yaml
resources:
- deployment.yaml
- service.yaml
EOF
```

Tasks 2 and 4. Generate the Namespace. Build the two patches from `increase_replicas.yaml` on
the Customizing section and the `envFrom` block on the ConfigMap task page, fixing the names.
The container is `nginx`, after its image:

```shell
k create namespace staging --dry-run=client -o yaml > staging/namespace.yaml
vim staging/increase_replicas.yaml
```

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shop
spec:
  replicas: 2
```

```shell
vim staging/env.yaml
```

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shop
spec:
  template:
    spec:
      containers:
      - name: nginx
        envFrom:
        - configMapRef:
            name: shop-settings
```

```shell
vim staging/kustomization.yaml
```

```yaml
resources:
- ../base
- namespace.yaml
namespace: staging
namePrefix: staging-
images:
- name: nginx
  newTag: "1.28"
patches:
  - path: increase_replicas.yaml
  - path: env.yaml
configMapGenerator:
- name: shop-settings
  literals:
  - MODE=staging
```

```shell
k apply -k staging
```

Task 3. The build error names the patch target:

```shell
k kustomize /opt/course/3/overlay
```

```
error: no resource matches strategic merge patch "Deployment.v1.apps/tools-api.[noNs]": no matches for Id Deployment.v1.apps/tools-api.[noNs]; failed to find unique target for patch Deployment.v1.apps/tools-api.[noNs]
```

The patch names the prefixed `tools-api`. In `vim /opt/course/3/overlay/replicas.yaml`, change
it to the base's name, `api`, then apply:

```shell
k apply -k /opt/course/3/overlay
```

</details>

## Check your work

On `controlplane`:

1. The `staging` Deployment runs 2 replicas of `nginx:1.28` and reads the generated ConfigMap:

   ```shell
   k get deploy staging-shop -n staging -o jsonpath='{.spec.replicas} {.spec.template.spec.containers[0].image} {.spec.template.spec.containers[0].envFrom[0].configMapRef.name}{"\n"}'
   k exec -n staging deploy/staging-shop -- printenv MODE
   ```

   ```
   2 nginx:1.28 staging-shop-settings-7t6ch9d7dd
   staging
   ```

## Further reading

* The [Kustomize](../../references/kustomize.md) reference has the fields an overlay can set, patches,
  generated names and the failure modes in one place.
* [Declarative Management of Kubernetes Objects Using Kustomize](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/)
  covers `secretGenerator`, `generatorOptions` and `replacements`, which copies a field from one
  object into others.
