# Kubernetes Objects

Everything you run on Kubernetes is an object: a record of what you want, which the cluster
then works to make true. In this topic you run a [Pod](../../references/pod.md), write one in YAML, keep copies of it
running with a [ReplicaSet](../../references/workloads.md#deployments-and-replicasets) and a [Deployment](../../references/workloads.md), give them one address with a [Service](../../references/services.md), group objects in
[namespaces](../../references/namespaces.md), and change objects with `kubectl create` and `kubectl apply`.
[How a Kubernetes cluster works](../../learn/cluster-architecture.md) explains desired state and the [controllers](../../references/control-plane.md#components) that act on it, and
[how kubectl talks to the cluster](../../learn/kubectl.md) explains what each command sends.

<!-- lab: cluster -->

You log in to `base`, which has no `kubectl`. From there you can `ssh` to `controlplane` and the two workers, `node01` and `node02`, which make up a working cluster with [Flannel](../../references/pod-network.md#plugins) as its pod network. Every command runs on `controlplane`.

## Objectives

* Run a Pod, read its status, and see that a deleted pod stays deleted.
* Write a Pod [manifest](../../references/kubectl.md#generating-yaml) from the docs and create the pod from the file.
* Keep a number of pods running with a ReplicaSet, and scale it.
* Run a Deployment and follow its pods back to it through its ReplicaSet.
* Give a Deployment's pods one address with a Service, and reach it by name.
* Create objects in a namespace, and list and reach them across namespaces.
* Tell `kubectl create` from `kubectl apply`, and change an object by editing its file.

## Run a pod

A [Pod](../../references/pod.md) is the smallest thing Kubernetes runs: one or more containers that share an IP address,
placed together on one [node](../../references/workers.md), a machine in the cluster.

1. Go to `controlplane` and start a pod. `ssh controlplane` opens a shell on the machine that
   runs the cluster's [control plane](../../references/control-plane.md), where `kubectl` works. `kubectl run web` creates a pod
   named `web`, and `--image=nginx:1.27` is the container image it runs, version `1.27` of the
   nginx web server:

   ```shell
   ssh controlplane
   kubectl run web --image=nginx:1.27
   ```

   It prints `pod/web created`. The cluster has stored the pod, which does not mean it runs
   yet. Wherever `kubectl` works, [`k`](../../references/kubectl.md#the-k-alias-and-short-names) is the same command with Tab completion: type `k get dep`
   and press Tab, and it writes `deployments`.

2. List the pods. `get pods` lists every pod in the namespace you are working in, `default`:

   ```shell
   k get pods
   ```

   The first time, the image is still downloading:

   ```
   NAME   READY   STATUS              RESTARTS   AGE
   web    0/1     ContainerCreating   0          0s
   ```

   `READY` is the pod's ready containers out of all its containers, so `0/1` means its one
   container is not ready yet. `ContainerCreating` means the pod has a node and its container
   is being set up. Run the command again after a few seconds, until it shows `1/1` and
   `Running`. `RESTARTS` counts how often a container has restarted, and `AGE` is how long ago
   the pod was created.

3. See where it runs. `-o wide` adds more columns:

   ```shell
   k get pods -o wide
   ```

   `IP` is the pod's own address, and `NODE` is the machine it runs on:

   ```
   NAME   READY   STATUS    RESTARTS   AGE   IP           NODE     NOMINATED NODE   READINESS GATES
   web    1/1     Running   0          2s    10.244.1.3   node01   <none>           <none>
   ```

   Every pod gets its own IP from the pod network. `NOMINATED NODE` and `READINESS GATES` stay
   `<none>` for an ordinary pod.

4. Read what happened to it. `describe pod web` prints the pod's details, and ends with its
   `Events`, each thing the cluster did to it, oldest first:

   ```shell
   k describe pod web
   ```

   The events at the bottom are the pod's life so far:

   ```
   Events:
     Type    Reason     Age   From               Message
     ----    ------     ----  ----               -------
     Normal  Scheduled  8s    default-scheduler  Successfully assigned default/web to node01
     Normal  Pulling    7s    kubelet            Pulling image "nginx:1.27"
     Normal  Pulled     0s    kubelet            Successfully pulled image "nginx:1.27" in 7.264s (7.264s including waiting). Image size: 68857691 bytes.
     Normal  Created    0s    kubelet            Created container: web
     Normal  Started    0s    kubelet            Started container web
   ```

   The [scheduler](../../references/control-plane.md#components) chose `node01` for the pod, `default/web` being its namespace and name.
   Then the kubelet on `node01`, the agent that runs pods on that machine, pulled the
   image, created the container and started it.

5. Delete the pod and list again. `delete pod web` deletes the pod by name:

   ```shell
   k delete pod web
   k get pods
   ```

   It prints `pod "web" deleted from default namespace`, then
   `No resources found in default namespace.` Nothing recreates a pod you created on its own.

## Write a pod in YAML

Any object can be written as a [manifest](../../references/kubectl.md#generating-yaml), a YAML file that `kubectl` sends to the cluster. The
docs have one for each common type, ready to copy.

1. Search kubernetes.io for `pods`, open
   [Pods](https://kubernetes.io/docs/concepts/workloads/pods/#using-pods), and find the example
   file `pods/simple-pod.yaml` under "Using Pods". Click its copy button.

2. Paste it into a new file. `vim nginx.yaml` opens the file `nginx.yaml` in vim. Type
   `:set paste` and Enter, so vim keeps the pasted indentation, then `i` to start typing.
   Paste with Ctrl+Shift+V and change the image to `nginx:1.27`. Press Esc, then type `:wq` to
   save and quit:

   ```shell
   vim nginx.yaml
   ```

   The file holds the four fields every manifest needs:

   ```yaml
   apiVersion: v1
   kind: Pod
   metadata:
     name: nginx
   spec:
     containers:
     - name: nginx
       image: nginx:1.27
       ports:
       - containerPort: 80
   ```

   `apiVersion` is the version of the Kubernetes API the type belongs to, `v1` for a pod.
   `kind` is the type of object. `metadata` identifies the object, here by its `name`. `spec` is
   the state you want: a list of `containers`, where each `-` starts one container with its
   `name`, its `image`, and the `containerPort` it listens on.

3. Create the pod from the file. `create -f nginx.yaml` sends the object in the file to the
   cluster:

   ```shell
   k create -f nginx.yaml
   ```

   It prints `pod/nginx created`.

4. Read the pod back as the cluster stores it. `get pod nginx -o yaml` prints the whole
   object, and `grep -E '^[a-z]'` keeps the lines that start with a letter, the top-level
   fields:

   ```shell
   k get pod nginx -o yaml | grep -E '^[a-z]'
   ```

   The cluster added a fifth field:

   ```
   apiVersion: v1
   kind: Pod
   metadata:
   spec:
   status:
   ```

   `status` is what the cluster last saw, and the cluster writes it, never you. Once the pod
   runs, its `phase` is `Running` and `podIP` holds the pod's address.

5. Look up a field the docs' example leaves out. [`explain`](../../references/kubectl.md#kubectl-explain) prints the fields of any type
   from the cluster's own schema. `pod.spec.containers.resources` is a path through the YAML:
   the type, then each field below it, joined with dots. `| head -13` keeps the first 13 lines:

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
   list. `--recursive` prints every field below the path at once, without descriptions.

6. Delete the pod with the file. `delete -f nginx.yaml` deletes the objects the file
   describes:

   ```shell
   k delete -f nginx.yaml
   ```

   It prints `pod "nginx" deleted from default namespace`.

## Keep pods running with a ReplicaSet

A [ReplicaSet](../../references/workloads.md#deployments-and-replicasets) keeps a set number of identical pods running. It finds its pods by [label](../../references/labels.md), a
key-value pair on an object, and creates new ones from its [pod template](../../references/workloads.md#the-pod-template) when there are too few. No
`kubectl create` command writes a ReplicaSet, so copy it from the docs.

1. Search kubernetes.io for `replicaset`, open
   [ReplicaSet](https://kubernetes.io/docs/concepts/workloads/controllers/replicaset/#example),
   and copy the example file `controllers/frontend.yaml` under "Example". Paste it into
   `vim frontend.yaml` with `:set paste`, and change the container's `name` to `nginx` and its
   `image` to `nginx:1.27`:

   ```shell
   vim frontend.yaml
   ```

   The file now reads:

   ```yaml
   apiVersion: apps/v1
   kind: ReplicaSet
   metadata:
     name: frontend
     labels:
       app: guestbook
       tier: frontend
   spec:
     # modify replicas according to your case
     replicas: 3
     selector:
       matchLabels:
         tier: frontend
     template:
       metadata:
         labels:
           tier: frontend
       spec:
         containers:
         - name: nginx
           image: nginx:1.27
   ```

   `apps/v1` means the type is in the `apps` [API group](../../references/api-groups.md). The labels under the top `metadata` are the
   ReplicaSet's own. `replicas` is how many pods to keep. `selector` says which pods count as
   its own, those labelled `tier: frontend`. `template` is the pod to create, with the same
   `metadata` and `spec` as a pod manifest, and its labels must match the selector. A line
   starting with `#` is a comment.

2. Create it, then list the ReplicaSet and its pods. `apply -f frontend.yaml` creates what the
   file describes. `get rs` lists ReplicaSets, `rs` being short for `replicasets`, and
   `--show-labels` adds a column with each pod's labels:

   ```shell
   k apply -f frontend.yaml
   k get rs
   k get pods --show-labels
   ```

   `DESIRED` is the `replicas` you asked for, `CURRENT` is how many pods exist, and `READY` is
   how many are ready:

   ```
   NAME       DESIRED   CURRENT   READY   AGE
   frontend   3         3         3       10s
   NAME             READY   STATUS    RESTARTS   AGE   LABELS
   frontend-nkql9   1/1     Running   0          10s   tier=frontend
   frontend-rxmcq   1/1     Running   0          10s   tier=frontend
   frontend-zxzcp   1/1     Running   0          10s   tier=frontend
   ```

   Each pod is named after the ReplicaSet with a random suffix, and carries the template's
   label `tier=frontend`.

3. Delete one pod and list again. Use one of your pod names:

   ```shell
   k delete pod frontend-nkql9
   k get pods
   ```

   A new pod has taken its place:

   ```
   NAME             READY   STATUS    RESTARTS   AGE
   frontend-q7chl   1/1     Running   0          1s
   frontend-rxmcq   1/1     Running   0          11s
   frontend-zxzcp   1/1     Running   0          11s
   ```

   `frontend-q7chl` is 1 second old. The ReplicaSet saw two pods where it wanted three, and
   created one from its template.

4. Scale it. `scale rs frontend --replicas=5` changes `replicas` on the ReplicaSet in the
   cluster:

   ```shell
   k scale rs frontend --replicas=5
   k get rs frontend
   ```

   `DESIRED` and `CURRENT` are 5 straight away, and `READY` catches up as the new containers
   start:

   ```
   NAME       DESIRED   CURRENT   READY   AGE
   frontend   5         5         3       11s
   ```

5. Delete the ReplicaSet. `delete rs frontend` deletes it, and with it every pod it owns:

   ```shell
   k delete rs frontend
   k get pods
   ```

   After a few seconds, `get pods` prints `No resources found in default namespace.`

## Run a Deployment

A [Deployment](../../references/workloads.md) creates and manages a ReplicaSet for you, and can replace its pods with a new version.
The ReplicaSet page recommends
[using Deployments instead](https://kubernetes.io/docs/concepts/workloads/controllers/replicaset/#deployment-recommended)
of creating ReplicaSets yourself.

1. Create a Deployment with three pods. `create deployment web` makes a Deployment named
   `web`, `--image=nginx:1.27` is the image of its one container, and `--replicas=3` is how many
   pods it keeps. `rollout status deploy/web` waits until all three are ready:

   ```shell
   k create deployment web --image=nginx:1.27 --replicas=3
   k rollout status deploy/web
   ```

   It ends with `deployment "web" successfully rolled out`.

2. List the Deployment, its ReplicaSet and its pods. `get deploy,rs,pods` lists three types in
   one command, separated by commas:

   ```shell
   k get deploy,rs,pods
   ```

   The names show the chain: the ReplicaSet is named after the Deployment, and each pod after
   the ReplicaSet:

   ```
   NAME                  READY   UP-TO-DATE   AVAILABLE   AGE
   deployment.apps/web   3/3     3            3           2s

   NAME                             DESIRED   CURRENT   READY   AGE
   replicaset.apps/web-66d47686b4   3         3         3       2s

   NAME                       READY   STATUS    RESTARTS   AGE
   pod/web-66d47686b4-7v5mz   1/1     Running   0          2s
   pod/web-66d47686b4-p7pql   1/1     Running   0          2s
   pod/web-66d47686b4-qvc9s   1/1     Running   0          2s
   ```

   The Deployment's `READY` is ready pods out of the pods it wants. `UP-TO-DATE` is how many
   run its current pod template, and `AVAILABLE` how many are ready to serve. `66d47686b4` is
   made from the pod template, so it changes when the template does.

3. Follow one pod back to its owners. `describe` prints `Controlled By`, the object that
   created it, and `grep` keeps that line. Use one of your pod names:

   ```shell
   k describe pod web-66d47686b4-7v5mz | grep 'Controlled By'
   k describe rs | grep 'Controlled By'
   ```

   The pod belongs to the ReplicaSet, and the ReplicaSet to the Deployment:

   ```
   Controlled By:  ReplicaSet/web-66d47686b4
   Controlled By:  Deployment/web
   ```

4. Change the image. `set image deploy/web nginx=nginx:1.28` sets the container named `nginx`
   to the image `nginx:1.28`; `k create deployment` named the container after its image.
   `rollout status` waits again, and `get rs` lists the ReplicaSets:

   ```shell
   k set image deploy/web nginx=nginx:1.28
   k rollout status deploy/web
   k get rs
   ```

   The Deployment made a second ReplicaSet for the new template and moved the pods across:

   ```
   NAME             DESIRED   CURRENT   READY   AGE
   web-66d47686b4   0         0         0       20s
   web-fbdc6fc8c    3         3         3       18s
   ```

   The old ReplicaSet stays, with no pods, so the change can be undone. This replacement is a
   [rollout](../../references/workloads.md#rollouts).

## Give pods one address with a Service

Each pod has [its own IP](../../learn/network-namespaces.md), and a pod that replaces it gets a new one. A [Service](../../references/services.md) gives a set of
pods one fixed IP and a [DNS name](../../learn/dns.md), and picks its pods by label.

1. Expose the Deployment. `expose deployment web` creates a Service named `web` that selects
   the Deployment's pods by their label, `app: web`, and `--port=80` is the port it listens
   on. `get svc web` shows it, `svc` being short for `services`:

   ```shell
   k expose deployment web --port=80
   k get svc web
   ```

   `CLUSTER-IP` is the Service's fixed address:

   ```
   NAME   TYPE        CLUSTER-IP    EXTERNAL-IP   PORT(S)   AGE
   web    ClusterIP   10.104.1.36   <none>        80/TCP    0s
   ```

   The type [ClusterIP](../../references/services.md#service-types), the default, can be reached only inside the cluster, so `EXTERNAL-IP`
   is `<none>`. `80/TCP` is the port and its protocol.

2. See which pods it sends traffic to. An [EndpointSlice](../../references/services.md#how-a-service-ip-answers) lists the pod IPs behind a Service, and
   `-l kubernetes.io/service-name=web` picks the one for `web` by its label. `get pods -o wide`
   shows the pods' IPs to compare:

   ```shell
   k get endpointslices -l kubernetes.io/service-name=web
   k get pods -o wide
   ```

   `ENDPOINTS` holds the same three addresses as the pods' `IP` column:

   ```
   NAME        ADDRESSTYPE   PORTS   ENDPOINTS                          AGE
   web-flmq4   IPv4          80      10.244.2.7,10.244.2.6,10.244.1.8   0s
   NAME                  READY   STATUS    RESTARTS   AGE   IP           NODE     NOMINATED NODE   READINESS GATES
   web-fbdc6fc8c-28pbb   1/1     Running   0          5s    10.244.2.7   node02   <none>           <none>
   web-fbdc6fc8c-89nwd   1/1     Running   0          14s   10.244.1.8   node01   <none>           <none>
   web-fbdc6fc8c-xvcq5   1/1     Running   0          22s   10.244.2.6   node02   <none>           <none>
   ```

3. Reach the Service by name from a pod. `run tmp` starts a pod from the small `busybox`
   image. `-i` shows what it prints, `--rm` deletes it when it ends, and `--restart=Never`
   makes it run once. Everything after `--` is its command: `wget -qO- web` fetches the page at
   `web` and prints it without progress messages. `| grep title` keeps the page's title:

   ```shell
   k run tmp --rm -i --restart=Never --image=busybox:1.37 -- wget -qO- web | grep title
   ```

   It prints `<title>Welcome to nginx!</title>`. [CoreDNS](../../references/pod-network.md#coredns), the cluster's DNS server, turned the name `web`
   into the Service's IP, and the connection went on to one of the three pods.

## Group objects in namespaces

A [namespace](../../references/namespaces.md) is a named group of objects. Everything so far went into `default`, because no
command named a namespace.

1. List the namespaces, and the pods in one of them. `get ns` lists namespaces, and
   `-n kube-system` asks about that namespace instead of `default`:

   ```shell
   k get ns
   k get pods -n kube-system
   ```

   `kube-system` holds the pods that make up the cluster itself:

   ```
   NAME              STATUS   AGE
   default           Active   3d2h
   kube-flannel      Active   3d2h
   kube-node-lease   Active   3d2h
   kube-public       Active   3d2h
   kube-system       Active   3d2h
   NAME                                   READY   STATUS    RESTARTS        AGE
   coredns-66bc5c9577-t6klc               1/1     Running   0               3d2h
   coredns-66bc5c9577-z9f8s               1/1     Running   0               3d2h
   etcd-controlplane                      1/1     Running   1 (2m41s ago)   3d2h
   kube-apiserver-controlplane            1/1     Running   1 (2m41s ago)   3d2h
   kube-controller-manager-controlplane   1/1     Running   1 (2m41s ago)   3d2h
   kube-proxy-4ptw9                       1/1     Running   1 (2m41s ago)   3d2h
   kube-proxy-jz6gh                       1/1     Running   1 (2m41s ago)   3d2h
   kube-proxy-p7g45                       1/1     Running   1 (2m41s ago)   3d2h
   kube-scheduler-controlplane            1/1     Running   1 (2m41s ago)   3d2h
   ```

   The four pods ending in `-controlplane` are the control plane, running on `controlplane`.
   There is one `kube-proxy` pod per node, which makes Service IPs work on that node, and two
   `coredns` pods. `1 (2m41s ago)` means the container restarted once, 2 minutes 41 seconds
   ago, when the machines last started.

2. Create a namespace, and a Deployment in it with the same name as the one in `default`.
   `create namespace dev` makes the namespace `dev`, and `-n dev` puts the Deployment there.
   `get deploy -A` lists Deployments in every namespace:

   ```shell
   k create namespace dev
   k create deployment web --image=nginx:1.27 -n dev
   k get deploy -A
   ```

   `NAMESPACE` shows two Deployments named `web`, one in each namespace:

   ```
   NAMESPACE     NAME      READY   UP-TO-DATE   AVAILABLE   AGE
   default       web       3/3     3            3           34s
   dev           web       0/1     1            0           0s
   kube-system   coredns   2/2     2            2           3d2h
   ```

   A name has to be unique only within its namespace. `coredns` is the Deployment that runs
   the two `coredns` pods.

3. Reach the Service in `default` from a pod in `dev`, first by `web.default`, then by `web`.
   `-n dev` starts the pod in `dev`, and `-T 3` makes `wget` give up after 3 seconds:

   ```shell
   k run tmp --rm -i --restart=Never -n dev --image=busybox:1.37 -- wget -qO- web.default | grep title
   k run tmp --rm -i --restart=Never -n dev --image=busybox:1.37 -- wget -qO- -T 3 web
   ```

   The first prints the title. The second fails:

   ```
   wget: bad address 'web'
   pod dev/tmp terminated (Error)
   pod "tmp" deleted from dev namespace
   ```

   A name without a namespace finds only Services in the pod's own namespace, and `dev` has no
   Service `web`, so `bad address` means the name found no IP. `<service>.<namespace>` reaches
   one in another namespace. `terminated (Error)` means `wget` exited with an error.

4. List which types live in a namespace, and their short names. `api-resources` prints every
   type the cluster knows, one per line. `grep -wE` keeps only the lines that contain one of the
   names between the `|` signs as a whole word, and `NAME` keeps the header line:

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

   [Secrets](../../references/config.md#secrets) have no short name, and namespaces are the only type here that is not namespaced.
   `APIVERSION` is what a manifest of that type puts in its `apiVersion` line, and `KIND` is
   what it puts in `kind`.

## Create or apply

`kubectl create` is [imperative](../../references/kubectl.md#generating-yaml): it makes the object you name, and fails if it exists.
`kubectl apply` is [declarative](../../references/kubectl.md#create-and-apply): it makes the cluster match a file, whether the object exists or
not.

1. Create the Deployment `web` in `default` again:

   ```shell
   k create deployment web --image=nginx:1.27
   ```

   It fails with
   `error: failed to create deployment: deployments.apps "web" already exists`.

2. Write a Deployment to a file, then apply the file twice. `--dry-run=client -o yaml` prints
   the object instead of creating it, and `> api.yaml` writes that into the file `api.yaml`:

   ```shell
   k create deployment api --image=nginx:1.27 --dry-run=client -o yaml > api.yaml
   k apply -f api.yaml
   k apply -f api.yaml
   ```

   The first `apply` prints `deployment.apps/api created`, and the second
   `deployment.apps/api unchanged`, because the cluster already matches the file.

3. In `vim api.yaml`, change `replicas: 1` to `replicas: 3`, then apply the file and list the
   Deployment:

   ```shell
   vim api.yaml
   k apply -f api.yaml
   k get deploy api
   ```

   It prints `deployment.apps/api configured`, and the Deployment now wants three pods:

   ```
   NAME   READY   UP-TO-DATE   AVAILABLE   AGE
   api    0/3     3            0           0s
   ```

   `READY` reaches `3/3` once the containers start.

4. Create from the same file. `create -f` fails for the same reason as in step 1:

   ```shell
   k create -f api.yaml
   ```

   It prints
   `Error from server (AlreadyExists): error when creating "api.yaml": deployments.apps "api" already exists`.

5. See what `apply` keeps. `apply` stores the file it was given in an annotation on the
   object, `kubectl.kubernetes.io/last-applied-configuration`. `-o jsonpath` prints that one
   field, and `\.` keeps each dot in the annotation's name from being read as a step down:

   ```shell
   k get deploy api -o jsonpath='{.metadata.annotations.kubectl\.kubernetes\.io/last-applied-configuration}'
   ```

   It is your file, written as JSON:

   ```
   {"apiVersion":"apps/v1","kind":"Deployment","metadata":{"annotations":{},"labels":{"app":"api"},"name":"api","namespace":"default"},"spec":{"replicas":3,"selector":{"matchLabels":{"app":"api"}},"strategy":{},"template":{"metadata":{"labels":{"app":"api"}},"spec":{"containers":[{"image":"nginx:1.27","name":"nginx","resources":{}}]}}},"status":{}}
   ```

   The next `apply` compares the file with this copy and with the live object, so a field you
   delete from the file is deleted from the object too.

6. Start a pod, then try to change its command with `k edit`. `busybox` is a small image of
   shell tools. Everything after `--` is passed to the container, here `sleep 3600`, which
   keeps it running for an hour. `k edit` opens the live object in vim and sends your change
   when you save:

   ```shell
   k run tool --image=busybox:1.37 -- sleep 3600
   k edit pod tool
   ```

   In vim, change `"3600"` to `"7200"` under `args`, and `:wq`. The change is refused:

   ```
   error: pods "tool" is invalid
   A copy of your changes has been stored to "/tmp/kubectl-edit-2739834084.yaml"
   error: Edit cancelled, no valid changes were saved.
   ```

   Most of a running pod's spec cannot change. `k edit` keeps your edit in the file it names.

7. Replace the pod from that file. `replace -f` replaces an object with the one in the file,
   and `--force` does it by deleting the object and creating it again, which is the only way to
   change a field that cannot be updated:

   ```shell
   k replace --force -f /tmp/kubectl-edit-2739834084.yaml
   ```

   It prints `pod "tool" deleted from default namespace` and then `pod/tool replaced`.

8. Delete the pod, and the Deployment with its file:

   ```shell
   k delete pod tool
   k delete -f api.yaml
   ```

## Quiz

<details><summary>You delete a pod you created with `kubectl run`. What brings it back?</summary>

Nothing. Only a pod that a ReplicaSet owns, directly or through a Deployment, is replaced.
</details>

<details><summary>Which four fields does every manifest have, and what does each hold?</summary>

`apiVersion`, the API version of the type. `kind`, the type. `metadata`, the name and other
data that identify the object. `spec`, the state you want.
</details>

<details><summary>Which top-level field does the cluster add to an object, and what is in it?</summary>

`status`, what the cluster last saw, such as a pod's `phase` and `podIP`. You never write it.
</details>

<details><summary>How does a ReplicaSet know which pods are its own, and what does it do when one is deleted?</summary>

Its `selector` matches the pods' labels, which its pod template sets. When fewer pods match
than `replicas` asks for, it creates new ones from the template.
</details>

<details><summary>A pod is named `web-66d47686b4-7v5mz`. Which objects own it?</summary>

The ReplicaSet `web-66d47686b4`, which the Deployment `web` owns. `kubectl describe` shows each
in `Controlled By`.
</details>

<details><summary>A pod in `dev` runs `wget web` and gets `bad address 'web'`, though `default` has a Service `web`. What name works?</summary>

`web.default`. A name without a namespace finds only Services in the pod's own namespace.
</details>

<details><summary>`k create -f api.yaml` fails with `AlreadyExists`. Which command makes the cluster match the file?</summary>

`k apply -f api.yaml`. It creates the object if it is missing and changes it if it
differs.
</details>

<details><summary>`k edit` on a pod fails with `is invalid`. What now?</summary>

`k replace --force -f` the file whose name `k edit` printed. It deletes the pod and creates it
from your edited copy.
</details>

<details><summary>Which command lists every type with its short name, and whether it lives in a namespace?</summary>

`k api-resources`. `SHORTNAMES` has the short names, and `NAMESPACED` is `false` for types such
as namespaces and nodes.
</details>

<details><summary>You know a field exists but not where it goes in the YAML. Which command shows it?</summary>

`k explain <type>.<field>`, such as `k explain pod.spec.containers.resources`. `--recursive`
prints the whole tree below it.
</details>

## Practice

Do it again without the steps, in **15 minutes**.

1. **Host `controlplane`, weight 15%.** Create the namespace `store`, and in it a pod `front`
   running `nginx:1.27`.

   <details><summary>Hint</summary>

   `k run` creates a pod. Without `-n store` it lands in `default`.

   </details>

2. **Host `controlplane`, weight 25%.** In `store`, create a ReplicaSet `cache` that keeps 2 pods
   running `nginx:1.27`, labelled `app=cache`.

   <details><summary>Hint</summary>

   No `k create` command writes a ReplicaSet. Search the docs for ReplicaSet and copy
   `controllers/frontend.yaml`. The selector and the pod template's labels must match.

   </details>

3. **Host `controlplane`, weight 20%.** In `store`, create a Deployment `api` running `nginx:1.27`
   with 3 replicas.

   <details><summary>Hint</summary>

   `k create deployment` takes `--replicas`.

   </details>

4. **Host `controlplane`, weight 20%.** In `store`, create a Service `api` on port 80 for the pods
   of `api`.

   <details><summary>Hint</summary>

   `k expose deployment` uses the Deployment's pod label as the Service's selector.

   </details>

5. **Host `controlplane`, weight 20%.** Write the Deployment `api` to `~/api.yaml`, change it to 4
   replicas in the file, and apply the file.

   <details><summary>Hint</summary>

   `k create deployment` with `--dry-run=client -o yaml` writes the file without creating
   anything. `k apply -f` changes the Deployment that already exists.

   </details>

<details><summary>Solution</summary>

Every task runs on `controlplane`, so `ssh` there once from `base`.

**Task 1.** Create the namespace, then the pod in it. `-n store` puts the pod in `store`, and
without it the pod would land in `default`:

```shell
ssh controlplane
k create ns store
k run front --image=nginx:1.27 -n store
k get pod front -n store
```

`1/1` and `Running` show the pod's one container started:

```
NAME    READY   STATUS    RESTARTS   AGE
front   1/1     Running   0          13s
```

**Task 2.** No `k create` command writes a ReplicaSet, so copy `controllers/frontend.yaml` from
the ReplicaSet page into `vim cache.yaml` with `:set paste`. Change the name, the replicas, the
container, and both labels to `app: cache`, since the selector and the pod template's labels
must match. Delete the ReplicaSet's own labels, which the task does not ask for:

```yaml
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: cache
spec:
  replicas: 2
  selector:
    matchLabels:
      app: cache
  template:
    metadata:
      labels:
        app: cache
    spec:
      containers:
      - name: nginx
        image: nginx:1.27
```

```shell
k apply -f cache.yaml -n store
k get rs cache -n store
```

`DESIRED` 2 and `READY` 2 confirm the ReplicaSet created both pods from the template:

```
NAME    DESIRED   CURRENT   READY   AGE
cache   2         2         2       8s
```

**Task 3.** `--replicas=3` sets the pod count when the Deployment is created:

```shell
k create deployment api --image=nginx:1.27 --replicas=3 -n store
k get deploy api -n store
```

`3/3` means all three pods are ready:

```
NAME   READY   UP-TO-DATE   AVAILABLE   AGE
api    3/3     3            3           21s
```

**Task 4.** `expose` reads the Deployment's pod label, `app: api`, and uses it as the Service's
selector. The EndpointSlice shows which pods the Service found:

```shell
k expose deployment api --port=80 -n store
k get endpointslices -n store -l kubernetes.io/service-name=api
```

Three addresses under `ENDPOINTS` confirm the selector matches the three `api` pods:

```
NAME        ADDRESSTYPE   PORTS   ENDPOINTS                          AGE
api-zsffj   IPv4          80      10.244.2.2,10.244.1.2,10.244.1.3   21s
```

**Task 5.** `--dry-run=client -o yaml` writes the Deployment as it was created, with `-n store`
recorded as `namespace: store`. In vim, change `replicas: 3` to `replicas: 4`, then apply:

```shell
k create deployment api --image=nginx:1.27 --replicas=3 -n store --dry-run=client -o yaml > ~/api.yaml
vim ~/api.yaml
k apply -f ~/api.yaml
k get deploy api -n store
```

`apply` first warns that `api` is missing the `last-applied-configuration` annotation, because
`create` made it, and says it will be patched automatically. It then prints
`deployment.apps/api configured`, and the Deployment runs four pods:

```
NAME   READY   UP-TO-DATE   AVAILABLE   AGE
api    4/4     4            4           23s
```

</details>

## Check your work

On `controlplane`:

1. Everything in `store`:

   ```shell
   k get pods,rs,deploy,svc -n store
   ```

   All 7 pods are `Running`: `front`, 2 from `cache` and 4 from `api`. `cache` has 2 ready pods,
   `api` shows `4/4`, and the Service `api` has a `CLUSTER-IP` on `80/TCP`.

2. The replicas in the file and in the cluster:

   ```shell
   grep replicas ~/api.yaml
   k get deploy api -n store -o jsonpath='{.spec.replicas}{"\n"}'
   ```

   Both say 4.

## Further reading

* [Objects in Kubernetes](https://kubernetes.io/docs/concepts/overview/working-with-objects/) has
  the four required fields and the difference between `spec` and `status`.
* [Kubernetes object management](https://kubernetes.io/docs/concepts/overview/working-with-objects/object-management/)
  compares imperative commands with `kubectl apply`.
* [kubectl Quick Reference](https://kubernetes.io/docs/reference/kubectl/quick-reference/) is on
  the allowed docs and lists more [imperative](../../references/kubectl.md#generating-yaml) commands and `jsonpath` examples.
