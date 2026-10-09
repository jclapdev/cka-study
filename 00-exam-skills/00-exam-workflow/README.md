# Working with kubectl

Each CKA task runs on a host you reach with `ssh`, is graded only on the final state, and
allows no tool beyond a terminal, vim and the kubernetes.io docs. In this topic you reach the
right host, generate YAML instead of typing it, copy snippets from the docs, and change and
check live objects. [About the CKA](../../EXAM.md) covers the format and grading, and
[how kubectl talks to the cluster](../../learn/kubectl.md) explains what each command does.

<!-- lab: cluster -->

You log in to `base`, which has no `kubectl`. From there you can `ssh` to `controlplane` and the two workers, `node01` and `node02`, which make up a working cluster with [Flannel](../../references/pod-network.md#plugins) as its pod network. Every command runs on `controlplane` unless a step says otherwise.

## Objectives

* Start on `base`, reach a worker with `ssh`, become root, and get back to `base`.
* Use `k`, its completion, and the short names for resource types.
* Generate a [Pod](../../references/pod.md), [Deployment](../../references/workloads.md), [Service](../../references/services.md), [ConfigMap](../../references/config.md) and [Secret](../../references/config.md#secrets) with `--dry-run=client -o yaml`.
* Find a [manifest](../../references/kubectl.md#generating-yaml) on kubernetes.io, copy it, and paste it into vim with its indentation intact.
* Look up a field with `kubectl explain`.
* Change live objects without opening their YAML, and replace a pod whose change is rejected.
* Read one value back to check the result.

## Reach the right host

You start on `base`, which has no `kubectl`. Each task names the [host to `ssh` into](../../references/kubectl.md#hosts-and-ssh).

1. Try `kubectl` on `base`. `kubectl get nodes` asks the cluster for its list of machines:

   ```shell
   kubectl get nodes
   ```

   It fails with `Command 'kubectl' not found`, because `base` has no Kubernetes tools.

2. Go to `node01`, become root, and try again. `ssh node01` opens a shell on the worker
   `node01`, and `sudo -i` turns it into a shell for the `root` user:

   ```shell
   ssh node01
   sudo -i
   kubectl get nodes
   ```

   This time `kubectl` exists but fails with `localhost:8080 was refused`, because `node01` has
   no [kubeconfig](../../references/kubeconfig.md), the file that tells `kubectl` where the cluster is and who you are. A task that says to work on
   `node01` means files and services on that machine, not the cluster.

3. Read the node's [container runtime](../../references/workers.md#what-a-worker-runs) version, then go back to `base`. containerd is the program
   that starts and stops the containers on this machine, and `--version` prints its version
   and nothing else:

   ```shell
   containerd --version
   exit
   exit
   ```

   The first `exit` leaves root, and the second leaves `node01`. `ssh node02` from `node01`
   is nested ssh, which the CKA does not support.

4. Go to `controlplane`, where the rest of the steps run. It is the machine that runs the
   cluster's [control plane](../../references/control-plane.md), and its kubeconfig lets `kubectl` work there:

   ```shell
   ssh controlplane
   ```

## Type less with `k`

[`k`](../../references/kubectl.md#the-k-alias-and-short-names) is `kubectl` with bash completion, on every host a task names.

1. List the nodes with `k` and the short name `no`. `get` lists every object of the type you
   name, and `no` is short for `nodes`:

   ```shell
   k get no
   ```

   Each node is listed with its `STATUS`, which is `Ready` when it can run pods. Type
   `k get dep` and press Tab: completion writes `deployments`. It completes object names and
   `-n` namespaces too.

2. List the short names of the types used most. `api-resources` prints every type the cluster
   knows, one per line. `grep -wE` keeps only the lines that contain one of the names between
   the `|` signs as a whole word, and `NAME` keeps the header line:

   ```shell
   k api-resources | grep -wE 'NAME|pods|deployments|services|configmaps|secrets|namespaces|serviceaccounts|persistentvolumeclaims|networkpolicies'
   ```

   `SHORTNAMES` is what you can type instead of the full name, and `NAMESPACED` says whether
   the object lives in a namespace:

   ```
   NAME                                SHORTNAMES   APIVERSION                        NAMESPACED   KIND
   configmaps                          cm           v1                                true         ConfigMap
   namespaces                          ns           v1                                false        Namespace
   persistentvolumeclaims              pvc          v1                                true         PersistentVolumeClaim
   pods                                po           v1                                true         Pod
   secrets                                          v1                                true         Secret
   serviceaccounts                     sa           v1                                true         ServiceAccount
   services                            svc          v1                                true         Service
   deployments                         deploy       apps/v1                           true         Deployment
   networkpolicies                     netpol       networking.k8s.io/v1              true         NetworkPolicy
   ```

   Secrets have no short name, and namespaces are the only type here that is not namespaced.
   `APIVERSION` is what a manifest of that type puts in its `apiVersion` line, and `KIND` is
   what it puts in `kind`.

## Generate YAML instead of typing it

[`--dry-run=client -o yaml`](../../references/kubectl.md#generating-yaml) prints the object a command would create, without creating it.
Redirect it to a file to edit before applying.

1. Print a Pod, the smallest thing Kubernetes runs: one or more containers started together
   on one node. `k run web` makes a pod named `web`. `--image=nginx:1.27` is the container
   image to run, version `1.27` of `nginx`. `--dry-run=client` builds the object inside
   `kubectl` without sending it to the cluster, and `-o yaml` prints it as YAML:

   ```shell
   k run web --image=nginx:1.27 --dry-run=client -o yaml
   ```

   Every object has the same four top-level parts: `apiVersion` and `kind` say what it is,
   `metadata` names it, and `spec` is what you asked for:

   ```
   apiVersion: v1
   kind: Pod
   metadata:
     labels:
       run: web
     name: web
   spec:
     containers:
     - image: nginx:1.27
       name: web
       resources: {}
     dnsPolicy: ClusterFirst
     restartPolicy: Always
   status: {}
   ```

   `containers` is a list, and each `-` starts one container with its `image` and `name`.
   `run` named both the pod and its container `web`, and added `run: web` to the pod's
   metadata. `dnsPolicy` and `restartPolicy` are defaults you can delete, and `status: {}` is
   empty because nothing was created.

2. Write a Deployment to a file, then create a namespace and apply the file there. A
   Deployment keeps a set number of identical pods running and replaces them when you change
   it. `--replicas=2` asks for two pods, and `> web.yaml` writes the printed YAML into the file
   `web.yaml` instead of the screen. A namespace is a named group of objects, and
   `k create namespace drill` makes one called `drill`. `apply -f web.yaml` creates what the
   file describes, or updates it if it exists, and `-n drill` puts it in `drill`:

   ```shell
   k create deployment web --image=nginx:1.27 --replicas=2 --dry-run=client -o yaml > web.yaml
   k create namespace drill
   k apply -f web.yaml -n drill
   ```

   `web.yaml` has the pod [labels](../../references/labels.md) `app: web` and a container named `nginx`, after the image.

3. Print the Service that would expose it. A Service gives a set of pods one stable address.
   `expose deployment web` makes a Service for the pods of the Deployment `web`, and
   `--port=80` is the port the Service listens on:

   ```shell
   k expose deployment web -n drill --port=80 --dry-run=client -o yaml
   ```

   The Service sends traffic on `port` 80 to `targetPort` 80 on every pod its `selector`
   matches:

   ```
   apiVersion: v1
   kind: Service
   metadata:
     labels:
       app: web
     name: web
     namespace: drill
   spec:
     ports:
     - port: 80
       protocol: TCP
       targetPort: 80
     selector:
       app: web
   status:
     loadBalancer: {}
   ```

   The selector `app: web` is the Deployment's pod label. `expose` reads it from the cluster,
   so the Deployment has to exist first. With no `--target-port`, the pods' port is the same as
   the Service's.

4. Print a ConfigMap and a Secret. Both hold settings for pods to read as key-value pairs; a
   Secret is for passwords and tokens. `generic` is the kind of Secret made from plain values,
   and `--from-literal=MODE=fast` adds the key `MODE` with the value `fast`:

   ```shell
   k create configmap web-config -n drill --from-literal=MODE=fast --dry-run=client -o yaml
   k create secret generic web-secret -n drill --from-literal=TOKEN=abc123 --dry-run=client -o yaml
   ```

   Both keep their values under `data`, one key per `--from-literal`:

   ```
   apiVersion: v1
   data:
     MODE: fast
   kind: ConfigMap
   metadata:
     name: web-config
     namespace: drill
   apiVersion: v1
   data:
     TOKEN: YWJjMTIz
   kind: Secret
   metadata:
     name: web-secret
     namespace: drill
   ```

   The Secret's value is base64-encoded for you: `YWJjMTIz` is `abc123`. Written by hand as
   `TOKEN: abc123` under `data`, it is rejected with `illegal base64 data at input byte 4`.

## Copy a manifest from the docs

No `kubectl create` command writes a NetworkPolicy, a PersistentVolume or a
PersistentVolumeClaim. A NetworkPolicy is a set of rules for which pods may talk to which, a
PersistentVolume is a piece of storage in the cluster, and a PersistentVolumeClaim is a pod's
request for one. The docs have [one for each](../../references/kubectl.md#snippets-from-the-docs), ready to copy.

1. Search kubernetes.io for `network policy`, open
   [Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/#default-deny-all-ingress-traffic),
   and find the example file under "Default deny all ingress traffic". Click its copy button.

2. Open a new file in vim and paste without re-indenting. `vim deny.yaml` opens the file
   `deny.yaml`, creating it when you save:

   ```shell
   vim deny.yaml
   ```

   Type `:set paste` and Enter, then `i`, then paste. Paste is Ctrl+Shift+V, as in the
   CKA terminal. Press Esc, and `:wq` to save. The file holds:

   ```yaml
   ---
   apiVersion: networking.k8s.io/v1
   kind: NetworkPolicy
   metadata:
     name: default-deny-ingress
   spec:
     podSelector: {}
     policyTypes:
     - Ingress
   ```

   `podSelector: {}` selects every pod in the namespace. `policyTypes: [Ingress]` with no
   `ingress` rules allows no incoming traffic at all, so the policy denies all of it. Without
   `:set paste`, vim can indent each pasted line one step further than the one above it, and
   the YAML no longer parses. [vim for YAML](../../references/kubectl.md#vim-for-yaml) has the other keys.

3. Apply it to `drill`:

   ```shell
   k apply -f deny.yaml -n drill
   ```

   This cluster's pod network, [Flannel](../../references/pod-network.md#plugins), does not enforce NetworkPolicies, so the policy exists but
   blocks nothing here.

## Look up a field

[`kubectl explain`](../../references/kubectl.md#kubectl-explain) prints the fields of any type, from the cluster's own schema.

1. Show one field and what it holds. `pod.spec.containers.resources` is a path through the
   YAML: the type, then each field below it, joined with dots. `| head -13` keeps the first 13
   lines:

   ```shell
   k explain pod.spec.containers.resources | head -13
   ```

   `FIELD` gives the field's type in angle brackets, and `FIELDS` lists what goes under it:

   ```
   KIND:       Pod
   VERSION:    v1

   FIELD: resources <ResourceRequirements>


   DESCRIPTION:
       Compute Resources required by this container. Cannot be updated. More info:
       https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/
       ResourceRequirements describes the compute resource requirements.

   FIELDS:
     claims	<[]ResourceClaim>
   ```

   `DESCRIPTION` says what the field is for. `[]` in a type, as in `<[]ResourceClaim>`, means a
   list.

2. Show a whole subtree at once. `deploy.spec.strategy` is the setting for how a Deployment
   replaces its pods, and `--recursive` prints every field below it, without descriptions:

   ```shell
   k explain deploy.spec.strategy --recursive
   ```

   `--recursive` lists every field below `strategy`, and `enum` gives the only values `type`
   accepts:

   ```
   GROUP:      apps
   KIND:       Deployment
   VERSION:    v1

   FIELD: strategy <DeploymentStrategy>


   DESCRIPTION:
       The deployment strategy to use to replace existing pods with new ones.
       DeploymentStrategy describes how to replace existing pods with new ones.

   FIELDS:
     rollingUpdate	<RollingUpdateDeployment>
       maxSurge	<IntOrString>
       maxUnavailable	<IntOrString>
     type	<string>
     enum: Recreate, RollingUpdate
   ```

   The indentation matches the YAML, so `maxSurge` goes under `rollingUpdate`, under
   `strategy`.

## Change live objects

Common changes have [their own commands](../../references/kubectl.md#changing-live-objects), which are faster than editing YAML.

1. Change the image, the replica count and a label. `deploy/web` names the Deployment `web` as
   type and name together. `set image` takes the container's name, `nginx`, then `=` and the
   new image. `scale --replicas=3` changes how many pods the Deployment keeps. `label` adds the
   label `tier=frontend` to the Deployment itself. `rollout status` waits until the new pods
   have replaced the old ones, and prints each stage:

   ```shell
   k set image deploy/web nginx=nginx:1.28 -n drill
   k scale deploy web --replicas=3 -n drill
   k label deploy web tier=frontend -n drill
   k rollout status deploy/web -n drill
   ```

   It ends with `deployment "web" successfully rolled out`. A new image changes the pods, so
   the Deployment replaces them; a new replica count adds pods without replacing any.

2. Start a pod, then try to change its command with `k edit`. `busybox` is a small image of
   shell tools. Everything after `--` is passed to the container, here `sleep 3600`, which
   keeps it running for an hour. `k edit` opens the live object in vim and sends your change
   when you save:

   ```shell
   k run tool --image=busybox:1.37 -n drill -- sleep 3600
   k edit pod tool -n drill
   ```

   In vim, change `"3600"` to `"7200"` under `args`, and `:wq`. The change is refused:

   ```
   error: pods "tool" is invalid
   A copy of your changes has been stored to "/tmp/kubectl-edit-2739834084.yaml"
   error: Edit cancelled, no valid changes were saved.
   ```

   Most of a running pod's spec cannot change. `k edit` keeps your edit in the file it names.

3. Delete the pod and create it again from that file. `replace -f` replaces an object with the
   one in the file, and `--force` does it by deleting the object and creating it again, which
   is the only way to change a field that cannot be updated:

   ```shell
   k replace --force -f /tmp/kubectl-edit-2739834084.yaml
   ```

   It prints `pod "tool" deleted from drill namespace` and then `pod/tool replaced`.

## Check the result

Only the cluster's final state is graded, so [read back](../../references/kubectl.md#checking-your-work) the exact value a task asked for.

1. Print two fields with `jsonpath`, and the same from `describe`. `-o jsonpath` prints only
   the fields you name: `{.spec.replicas}` is `replicas` under `spec`, `containers[0]` is the
   first container in the list, and `{"\n"}` ends the line. `describe` prints a readable
   summary, and `grep -E '^Replicas|Image'` keeps the lines that start with `Replicas` or
   contain `Image`:

   ```shell
   k get deploy web -n drill -o jsonpath='{.spec.replicas} {.spec.template.spec.containers[0].image}{"\n"}'
   k describe deploy web -n drill | grep -E '^Replicas|Image'
   ```

   The first line is the `jsonpath` output, the replica count then the image. The other two
   are the same values from `describe`:

   ```
   3 nginx:1.28
   Replicas:               3 desired | 3 updated | 3 total | 3 available | 0 unavailable
       Image:         nginx:1.28
   ```

   `desired` is the replica count you set and `available` is how many pods are ready, so
   `3 available` and `0 unavailable` mean the change is complete.

## Quiz

<details><summary>A task says to work on `node01`. Where does `kubectl` work, and how do you get back?</summary>

`kubectl` works on the host with a kubeconfig, `controlplane` here, and not on `base`. From
`base`, `ssh node01` reaches the worker, `sudo -i` gives root, and one `exit` per level returns
you to `base`.
</details>

<details><summary>What are the three sources of YAML, fastest first?</summary>

`k create`, `k run` or `k expose` with `--dry-run=client -o yaml`. Then a snippet copied from a
kubernetes.io page. Then `k explain` for a field neither shows.
</details>

<details><summary>Which common types have no `kubectl create` command?</summary>

NetworkPolicy, PersistentVolume and PersistentVolumeClaim. Copy them from the docs.
</details>

<details><summary>Pasted YAML in vim is indented one step further on every line. What prevents it?</summary>

`:set paste` before entering insert mode and pasting.
</details>

<details><summary>`k edit` on a pod fails with `is invalid`. What now?</summary>

`k replace --force -f` the file whose name `k edit` printed. It deletes the pod and creates it
from your edited copy.
</details>

<details><summary>You set `alias kn=...` in one task. Is it there in the next?</summary>

No. Each task is a new `ssh` session. Only `k` and its completion are always there.
</details>

## Practice

Do it again without the steps, in **12 minutes**.

1. **Host `controlplane`, weight 15%.** Create the namespace `shop`, and in it a Deployment `api`
   running `nginx:1.27` with 2 replicas.
2. **Host `controlplane`, weight 15%.** Expose `api` inside the cluster as a Service `api` on port
   80.
3. **Host `controlplane`, weight 20%.** In `shop`, create a ConfigMap `api-config` with
   `MODE=fast` and a Secret `api-secret` with `TOKEN=abc123`.
4. **Host `controlplane`, weight 20%.** In `shop`, create a NetworkPolicy `deny-in` that denies
   all ingress traffic to every pod in the namespace.
5. **Host `node01`, weight 15%.** Write the output of `containerd --version` on `node01` to
   `/opt/course/5/runtime.txt` on `node01`.
6. **Host `controlplane`, weight 15%.** Change `api` to run `nginx:1.28` with 3 replicas.

<details><summary>Solution</summary>

**Tasks 1 to 3.** Each object has a `k create` command, so no YAML is needed. `k expose` reads
the Deployment's pod label, `app: api`, for the Service's selector, so the Deployment has to
exist first:

```shell
ssh controlplane
k create ns shop
k create deployment api --image=nginx:1.27 --replicas=2 -n shop
k expose deployment api -n shop --port=80
k create configmap api-config -n shop --from-literal=MODE=fast
k create secret generic api-secret -n shop --from-literal=TOKEN=abc123
k get deploy,svc,cm,secret -n shop
```

The Deployment shows `2/2`, the Service has a `CLUSTER-IP` on `80/TCP`, and the ConfigMap and the
Secret each hold one key under `DATA`:

```
NAME                  READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/api   2/2     2            2           2s

NAME          TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)   AGE
service/api   ClusterIP   10.106.82.170   <none>        80/TCP    2s

NAME                         DATA   AGE
configmap/api-config         1      2s
configmap/kube-root-ca.crt   1      2s

NAME                TYPE     DATA   AGE
secret/api-secret   Opaque   1      2s
```

`kube-root-ca.crt` is in every namespace from the start, and holds the cluster's [CA certificate](../../references/certificates.md).

**Task 4.** No `k create` command writes a NetworkPolicy. Copy "Default deny all ingress
traffic" from the Network Policies page into `vim deny.yaml` with `:set paste`, and change the
name:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-in
spec:
  podSelector: {}
  policyTypes:
  - Ingress
```

```shell
k apply -f deny.yaml -n shop
k get netpol -n shop
```

`POD-SELECTOR` `<none>` is how `kubectl` shows `podSelector: {}`, which selects every pod in the
namespace:

```
NAME      POD-SELECTOR   AGE
deny-in   <none>         0s
```

**Task 5.** The file is on `node01`, so go back to `base` and `ssh` there. `/opt` belongs to
root, so `sudo -i` first:

```shell
exit          # back to base
ssh node01
sudo -i
mkdir -p /opt/course/5
containerd --version > /opt/course/5/runtime.txt
cat /opt/course/5/runtime.txt
exit
exit
```

`cat` prints the version line, which confirms the file holds the output and not an error:

```
containerd github.com/containerd/containerd/v2 2.2.1
```

**Task 6.** A new image starts a [rollout](../../references/workloads.md#rollouts), and `rollout status` waits until it ends. `jsonpath`
reads back the two values the task asked for:

```shell
ssh controlplane
k set image deploy/api nginx=nginx:1.28 -n shop
k scale deploy api --replicas=3 -n shop
k rollout status deploy/api -n shop
k get deploy api -n shop -o jsonpath='{.spec.template.spec.containers[0].image} {.status.readyReplicas}{"\n"}'
```

`nginx:1.28 3` is the new image and three ready pods.

</details>

## Check your work

On `controlplane`:

1. The Deployment's image and ready replicas:

   ```shell
   k get deploy api -n shop -o jsonpath='{.spec.template.spec.containers[0].image} {.status.readyReplicas}{"\n"}'
   ```

   ```
   nginx:1.28 3
   ```

2. The file on `node01`, from `base`:

   ```shell
   exit
   ssh node01 cat /opt/course/5/runtime.txt
   ```

   ```
   containerd github.com/containerd/containerd/v2 2.2.1
   ```

## Further reading

* The [kubectl](../../references/kubectl.md) reference has every command in this topic, the vim keys and
  the docs pages worth knowing, in one place.
* [kubectl Quick Reference](https://kubernetes.io/docs/reference/kubectl/quick-reference/) is on
  the allowed docs and lists more [imperative](../../references/kubectl.md#generating-yaml) commands and `jsonpath` examples.
* [killer.sh](https://killer.sh) (not available in the exam) runs the CKA's remote desktop, where
  Ctrl+Shift+C and Ctrl+Shift+V can be practised for real.
