# kubeadm Installation

`kubeadm` turns machines that already have a [container runtime](../../references/workers.md#what-a-worker-runs) and a [kubelet](../../references/control-plane.md#components) into a working
Kubernetes cluster. It generates the [certificates](../../references/certificates.md#client-and-serving-certificates), writes the [control plane](../../references/control-plane.md)'s [static pod](../../references/control-plane.md#static-pods)
[manifests](../../references/kubectl.md#generating-yaml), and prints a command that joins other machines to what it built.
[How a cluster works](../../learn/cluster-architecture.md) and [how kubeadm builds a cluster](../../learn/kubeadm.md) explain the parts.

<!-- lab: vms -->

You log in to `base`, which has no `kubectl`. From there you can `ssh` to `controlplane`, `node01` and `node02`. Each has containerd, the kubelet, kubeadm and kubectl installed, but there is no cluster yet. Every command runs on `controlplane` unless a step says otherwise.

## Objectives

* See why a kubelet with no cluster cannot start, and why `kubectl` cannot reach anything.
* Initialise a control plane with `kubeadm init` and read what it wrote.
* Find out how the apiserver can be a pod before there is an apiserver to create it.
* Install a pod network and watch the node go Ready.
* Join two workers with a token you generate yourself.
* Label the workers and confirm the whole control plane is healthy.

## Check what is already running

The machines have the Kubernetes tools installed but [no cluster](../../references/workers.md#the-kubelet-before-init-or-join).

1. Check the state of the kubelet, the agent on every node that starts the pods the cluster
   gives it. `systemctl status` shows whether a service that systemd runs is up, and why not:

   ```shell
   systemctl status kubelet
   ```

   The `Active` line shows the kubelet failing and being restarted:

   ```
   Active: activating (auto-restart) (Result: exit-code)
   ```

   The kubelet is installed and enabled, but it has no configuration file yet, so it exits at
   once and systemd restarts it every 10 seconds. `sudo journalctl -u kubelet` shows the
   missing file.

2. Try to talk to a cluster that does not exist yet. `k get nodes` asks the cluster for
   its list of machines:

   ```shell
   k get nodes
   ```

   It ends with the connection being refused:

   ```
   The connection to the server localhost:8080 was refused - did you specify the right host or port?
   ```

   There is no [kubeconfig](../../references/kubeconfig.md#resolution-order) yet, so kubectl used its built-in
   default of `localhost:8080`.

## Initialise the control plane

`kubeadm init` writes the control plane's address into the apiserver's [certificate](../../learn/tls.md) and into
every kubeconfig it generates, and the workers are later told to trust that exact address. A
wrong [address](../../references/kubeadm.md#the-advertise-address) is not fixable without `kubeadm reset`.

1. Get `controlplane`'s address and keep it in a variable. `ip route get 1.1.1.1` asks which
   route the machine would use to reach an address outside its own network, and prints a line
   such as `1.1.1.1 via 192.0.2.1 dev eth0 src 192.0.2.10`. `awk '{print $7; exit}'` prints the
   seventh word of that line, the address after `src`. `CP_IP=$(...)` stores the result in the
   shell variable `CP_IP`, and `echo` prints it:

   ```shell
   CP_IP=$(ip route get 1.1.1.1 | awk '{print $7; exit}'); echo "$CP_IP"
   ```

   The address must be one the other nodes can reach. `ip route get` prints the address the
   machine uses to reach other networks, which on a machine with more than one address is the
   one to advertise.

2. Initialise the cluster. `sudo` is needed because `init` writes under `/etc/kubernetes`
   and starts services. `--apiserver-advertise-address` is the address the apiserver tells
   the other nodes to use. `--pod-network-cidr 10.244.0.0/16` is the range pod addresses come
   from, which the pod network installed later hands out:

   ```shell
   sudo kubeadm init --apiserver-advertise-address "$CP_IP" --pod-network-cidr 10.244.0.0/16
   ```

   It prints 84 lines over about 90 seconds. The last lines tell you the three steps left: set
   up a kubeconfig, install a pod network, and join the workers:

   ```
   Your Kubernetes control-plane has initialized successfully!

   To start using your cluster, you need to run the following as a regular user:

     mkdir -p $HOME/.kube
     sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
     sudo chown $(id -u):$(id -g) $HOME/.kube/config

   Alternatively, if you are the root user, you can run:

     export KUBECONFIG=/etc/kubernetes/admin.conf

   You should now deploy a pod network to the cluster.
   Run "kubectl apply -f [podnetwork].yaml" with one of the options listed at:
     https://kubernetes.io/docs/concepts/cluster-administration/addons/

   Then you can join any number of worker nodes by running the following on each as root:

   kubeadm join 192.0.2.10:6443 --token x45qeh.cckxlv7xjht0wp4g \
   	--discovery-token-ca-cert-hash sha256:3e70b1b90336a52dde3e0ea7103a3e0ed5e94012f60c8a5936d56003736e6dee
   ```

   Each progress line starts with the phase that printed it, such as `[preflight]`, `[certs]`,
   `[kubeconfig]` or `[addons]`. [What kubeadm init does](../../references/kubeadm.md#what-kubeadm-init-does)
   lists each phase and the files it leaves.

> [!note]
> If `kubeadm init` stops with `[ERROR Port-6443]: Port 6443 is in use` or `[ERROR
> FileAvailable--etc-kubernetes-manifests-kube-apiserver.yaml]`, a control plane from an earlier
> attempt is still there. `sudo kubeadm reset -f` removes it.

### If pods are created through the apiserver, how did the apiserver pod start?

List the manifests `init` wrote. The folder belongs to root, so `ls` needs `sudo`:

```shell
sudo ls /etc/kubernetes/manifests/
```

There is one manifest for each control plane component. `etcd.yaml` runs [etcd](../../references/control-plane.md#components), [the database
that stores every object](../../learn/etcd.md):

```
etcd.yaml
kube-apiserver.yaml
kube-controller-manager.yaml
kube-scheduler.yaml
```

The kubelet watches that directory and starts whatever it finds there, without asking an
apiserver or a scheduler. That is how the control plane starts before there is a cluster to
start it. Because these pods come from files, editing one restarts that component within
seconds, and `k delete pod` on one does nothing lasting, because the kubelet recreates it
from the file ([static pods](../../references/control-plane.md#static-pods)).

## Point kubectl at the cluster

`kubeadm init` wrote an admin kubeconfig to `/etc/kubernetes/admin.conf`, owned by root with
mode `600`, and kubectl looks in `~/.kube/config`. Without the `chown`, the copy stays
root-owned and kubectl fails with `permission denied`. [On a kubeadm cluster](../../references/kubeconfig.md#on-a-kubeadm-cluster)
lists every kubeconfig `init` writes.

Copy the admin kubeconfig into your home directory. `mkdir -p` creates `~/.kube` and does
nothing if it exists. `sudo cp` copies the root-owned file, and `sudo chown "$(id -u):$(id -g)"`
makes your own user and group its owner, so kubectl can read it without `sudo`:

```shell
mkdir -p ~/.kube
sudo cp /etc/kubernetes/admin.conf ~/.kube/config
sudo chown "$(id -u):$(id -g)" ~/.kube/config
k get nodes
```

The node is `NotReady` until a pod network is installed.

> [!note]
> `The connection to the server localhost:8080 was refused` coming back later means kubectl found
> no kubeconfig. Either you ran it with `sudo`, which reads root's home instead of yours, or you
> are on a worker, which has no admin kubeconfig. Run it as your normal user on `controlplane`.

## Install a pod network

Kubernetes needs a [network plugin](../../learn/pod-network.md) to [give pods addresses](../../learn/network-namespaces.md), and kubeadm installs none. The
plugin uses one of [three address ranges](../../references/pod-network.md#three-cidrs-not-one) that must not overlap.

### Why is controlplane NotReady when all four control plane pods are running?

Check the node, the pods, and the [CNI](../../references/pod-network.md) configuration directory. `describe node` prints the
node's conditions, and `grep -A3 'Ready '` shows the `Ready` line and the 3 lines after it.
`-n kube-system` lists the namespace where the cluster's own components run:

```shell
k describe node controlplane | grep -A3 'Ready '
k get pods -n kube-system
sudo ls /etc/cni/net.d/
```

The node is `NotReady`, both `coredns` pods are `Pending`, and `/etc/cni/net.d/` prints nothing:

```
  Ready            False   Sun, 27 Sep 2026 17:14:37 -0400   Sun, 27 Sep 2026 17:14:34 -0400   KubeletNotReady              container runtime network not ready: NetworkReady=false reason:NetworkPluginNotReady message:Network plugin returns error: cni plugin not initialized
Addresses:
  InternalIP:  192.0.2.10
  Hostname:    controlplane
NAME                                   READY   STATUS    RESTARTS   AGE
coredns-66bc5c9577-7s2xq               0/1     Pending   0          5s
coredns-66bc5c9577-wst66               0/1     Pending   0          5s
etcd-controlplane                      0/1     Running   0          13s
kube-apiserver-controlplane            0/1     Running   0          13s
kube-controller-manager-controlplane   1/1     Running   0          13s
kube-proxy-4wdrl                       1/1     Running   0          6s
kube-scheduler-controlplane            0/1     Running   0          14s
```

`/etc/cni/net.d/` is empty, so the kubelet reports `cni plugin not initialized` and keeps the
node `NotReady`. A `NotReady` node carries the [taint](../../references/taints.md) `node.kubernetes.io/not-ready:NoSchedule`,
which [CoreDNS](../../references/pod-network.md#coredns) does not tolerate, so both CoreDNS pods stay [`Pending`](../../references/pod.md#on-a-new-cluster).

1. Install [Flannel](../../references/pod-network.md#plugins). It defaults to `10.244.0.0/16`, the CIDR you gave `init`. `k apply -f`
   reads a manifest from a URL as well as from a file. This one creates the `kube-flannel`
   namespace, the permissions Flannel needs, its settings, and the [DaemonSet](../../references/daemonsets.md) that runs one
   Flannel pod on every node:

   ```shell
   k apply -f https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml
   ```

2. Watch the node change to Ready, which takes about 20 seconds, then stop the watch with
   `Ctrl-C`. `-w` keeps the command running and prints a new line each time a node changes:

   ```shell
   k get nodes -w
   ```

3. Confirm what changed on disk and in `kube-system`:

   ```shell
   sudo ls /etc/cni/net.d/
   k get pods -n kube-system
   ```

   `/etc/cni/net.d/` now has Flannel's file, and every pod is `Running` except the two `coredns` pods:

   ```
   10-flannel.conflist
   NAME                                   READY   STATUS              RESTARTS   AGE
   coredns-66bc5c9577-7s2xq               0/1     ContainerCreating   0          33s
   coredns-66bc5c9577-wst66               0/1     ContainerCreating   0          33s
   etcd-controlplane                      1/1     Running             0          41s
   kube-apiserver-controlplane            1/1     Running             0          41s
   kube-controller-manager-controlplane   1/1     Running             0          41s
   kube-proxy-4wdrl                       1/1     Running             0          34s
   kube-scheduler-controlplane            1/1     Running             0          28s
   ```

   The configuration file Flannel wrote is what the kubelet was waiting for. CoreDNS is
   scheduled now, and passes through `ContainerCreating` while Flannel gives it an address.

> [!note]
> The node goes `Ready` as soon as the file exists, even if the plugin is broken. If the pod
> CIDR given to `init` does not match Flannel's `10.244.0.0/16`, or `init` was given none, the
> node is still `Ready`, but the Flannel pod is in `CrashLoopBackOff` and CoreDNS stays in
> `ContainerCreating`. `k logs -n kube-flannel -l app=flannel` names the mismatch.

## Join the workers

The [join line](../../references/workers.md#joining) printed by `init` contains a token that expires after 24 hours. `kubeadm token
create --print-join-command` prints a new one.

1. On `controlplane`, list the existing token and print a fresh join command.
   `kubeadm token list` shows the tokens a new node can use to join. `token create` makes a
   new one, and `--print-join-command` prints the whole `kubeadm join` line that uses it:

   ```shell
   sudo kubeadm token list
   sudo kubeadm token create --print-join-command
   ```

   The token from `init` expires in 23 hours (`TTL`), and the new join command carries a new
   token but the same hash:

   ```
   TOKEN                     TTL         EXPIRES                USAGES                   DESCRIPTION                                                EXTRA GROUPS
   x45qeh.cckxlv7xjht0wp4g   23h         2026-09-28T21:14:37Z   authentication,signing   The default bootstrap token generated by 'kubeadm init'.   system:bootstrappers:kubeadm:default-node-token
   kubeadm join 192.0.2.10:6443 --token 0llpfd.430vs5tnv5zfrcxq --discovery-token-ca-cert-hash sha256:3e70b1b90336a52dde3e0ea7103a3e0ed5e94012f60c8a5936d56003736e6dee
   ```

   The hash lets the joining node check that it reached the right apiserver. The token lets
   the apiserver accept the node for long enough to sign a client certificate for it.
   [Joining a node](../../learn/kubeadm.md#joining-a-node) walks through the sequence.

2. Copy the command you just printed, then run it on `node01`. Your token and hash differ from
   the ones above, so paste yours. `kubeadm join 192.0.2.10:6443` contacts the apiserver at that
   address on port 6443. `--token` proves the node may join, and
   `--discovery-token-ca-cert-hash` is the fingerprint of the cluster's certificate authority,
   which the node checks before trusting the apiserver. Go back to `base` first, because `ssh`
   from one cluster machine to another is refused:

   ```shell
   exit                         # back to base
   ssh node01
   sudo kubeadm join ...        # paste the command printed in the previous step
   exit
   ```

   The node confirms it has a certificate from the cluster:

   ```
   This node has joined the cluster:
   * Certificate signing request was sent to apiserver and a response was received.
   * The Kubelet was informed of the new secure connection details.

   Run 'kubectl get nodes' on the control-plane to see this node join the cluster.
   ```

3. Join `node02` the same way, with `ssh node02` from `base`. To run several commands as root,
   `sudo -i` opens a root shell, and `exit` leaves it before the next `exit` leaves the machine.

Workers get no admin kubeconfig, so `kubectl` on `node01` fails with the same `localhost:8080`
error. Run every `kubectl` command on `controlplane`.

## Label the workers

A node's role is a [label](../../references/labels.md#keys-and-values), not a field. Back on `controlplane`, with `ssh controlplane` from `base`:

1. List the nodes:

   ```shell
   k get nodes
   ```

   All three nodes are `Ready` and run the same kubelet version:

   ```
   NAME           STATUS   ROLES           AGE   VERSION
   controlplane   Ready    control-plane   87s   v1.34.10
   node01         Ready    <none>          35s   v1.34.10
   node02         Ready    <none>          35s   v1.34.10
   ```

   The ROLES column is built from [labels named `node-role.kubernetes.io/<role>`](../../references/workers.md#roles). kubeadm sets
   that label on `controlplane` and none on the workers.

2. Add the worker label to both. `label node node01 node02` labels both nodes in one
   command, and `node-role.kubernetes.io/worker=` is the key with an empty value:

   ```shell
   k label node node01 node02 node-role.kubernetes.io/worker=
   k get nodes
   ```

   `ROLES` now shows `worker` for both. The value after `=` is empty. The role name comes from the key.

## Check the control plane

List everything the cluster is running. `-A` lists every namespace, and `-o wide` adds
columns such as each pod's `IP` and `NODE`:

```shell
k get pods -A -o wide
```

Each pod is listed with its namespace, its address and the node it runs on (some columns
removed here):

```
NAMESPACE      NAME                                   STATUS            IP              NODE
kube-flannel   kube-flannel-ds-2plsz                  Running           192.0.2.11      node01
kube-flannel   kube-flannel-ds-fwbdp                  Running           192.0.2.10      controlplane
kube-flannel   kube-flannel-ds-mzw4c                  PodInitializing   192.0.2.12      node02
kube-system    coredns-66bc5c9577-7s2xq               Running           10.244.0.3      controlplane
kube-system    coredns-66bc5c9577-wst66               Running           10.244.0.2      controlplane
kube-system    etcd-controlplane                      Running           192.0.2.10      controlplane
kube-system    kube-apiserver-controlplane            Running           192.0.2.10      controlplane
kube-system    kube-controller-manager-controlplane   Running           192.0.2.10      controlplane
kube-system    kube-proxy-4wdrl                       Running           192.0.2.10      controlplane
kube-system    kube-proxy-7ghxx                       Running           192.0.2.12      node02
kube-system    kube-proxy-k7lwp                       Running           192.0.2.11      node01
kube-system    kube-scheduler-controlplane            Running           192.0.2.10      controlplane
```

Static pods are named `<component>-<node>`, such as `etcd-controlplane`. `kube-proxy` and
`kube-flannel-ds` each have one pod per node, because both are
[DaemonSets](../../references/daemonsets.md). Flannel installs into its own
[namespace](../../references/namespaces.md), `kube-flannel`, so `-n kube-system` does not show
it. `PodInitializing` means that pod's init containers are still running.

The two CoreDNS pods have `10.244.x` addresses from the pod CIDR. Every other pod has its node's
own address, because the control plane pods and both DaemonSets use the [host network](../../references/pod-network.md#pods-on-the-host-network).

When the cluster is healthy, no pod is `CrashLoopBackOff`, `Error` or `Pending`. [Phases](../../references/pod.md#phases)
says what each of those means.

## Quiz

<details><summary>Why can the apiserver be a pod?</summary>

Static pods. The kubelet starts anything it finds in `/etc/kubernetes/manifests/`
without consulting an apiserver, so the control plane does not depend on the
cluster already existing.
</details>

<details><summary>Why must the CNI's pod CIDR match --pod-network-cidr?</summary>

The [controller-manager](../../references/control-plane.md#components) gives each node a slice of the CIDR given to `init` and
records it in `spec.podCIDR`. Flannel only accepts slices inside its own
configured network. When they differ, Flannel crash-loops and pods get no
addresses, even though the node shows `Ready`.
</details>

<details><summary>kubectl worked a moment ago and now says localhost:8080 was refused.</summary>

Something changed which kubeconfig is being read: `sudo` (root's home, not
yours), a different user, an unset `KUBECONFIG`, or the file was never copied out
of `/etc/kubernetes/`.
</details>

<details><summary>What are the two secrets in a kubeadm join line for?</summary>

The [CA](../../references/certificates.md) cert hash proves the apiserver to the joining node. The bootstrap token
proves the node to the apiserver, for just long enough to get a client
certificate signed. It expires in 24 hours;
`kubeadm token create --print-join-command` makes a new one.
</details>

<details><summary>Which address goes in --apiserver-advertise-address?</summary>

The one the other nodes can reach, which `ip route get 1.1.1.1` prints. It ends up in the apiserver's
certificate and in every join command, so a wrong choice is not fixable without a
reset.
</details>

## Practice

Do it again without the steps, in **25 minutes**.

1. **Host `controlplane`, weight 19%.** Initialise a control plane with pod network CIDR
   `10.244.0.0/16`. The API server must advertise `controlplane`'s own IPv4 address.

   <details><summary>Hint</summary>

   `kubeadm init` takes `--pod-network-cidr` and `--apiserver-advertise-address`. `ip route get
   1.1.1.1` shows the address `controlplane` sends from.

   </details>

2. **Host `controlplane`, weight 12%.** Configure kubectl for your non-root user so that
   `k get nodes` works without `sudo` and without setting `KUBECONFIG`.

   <details><summary>Hint</summary>

   `kubectl` reads `~/.kube/config`. `init` prints the three commands that copy `admin.conf`
   there.

   </details>

3. **Host `controlplane`, weight 19%.** Install a CNI plugin that matches the pod CIDR, so that
   `controlplane` is `Ready` and CoreDNS is running.

   <details><summary>Hint</summary>

   Flannel's manifest uses `10.244.0.0/16`.

   </details>

4. **Hosts `controlplane`, `node01`, `node02`, weight 25%.** Join `node01` and `node02` as
   workers. Both must be `Ready`.

   <details><summary>Hint</summary>

   `kubeadm token create --print-join-command` prints a join command. Run it with `sudo` on each
   worker, reached from `base`.

   </details>

5. **Host `controlplane`, weight 12%.** Label both workers with `node-role.kubernetes.io/worker=`.

   <details><summary>Hint</summary>

   `k label node` takes several node names. A key ending in `=` sets an empty value.

   </details>

6. **Host `controlplane`, weight 13%.** Make sure `kube-apiserver`, `kube-controller-manager`,
   `kube-scheduler` and `etcd` are `Running`, and no pod in `kube-system` is in
   `CrashLoopBackOff`.

   <details><summary>Hint</summary>

   `k get pods -n kube-system` lists them. The control plane pods end in `-controlplane`.

   </details>

<details><summary>Solution</summary>

**Task 1.** `ip route get 1.1.1.1` asks which of the machine's addresses it would send from to
reach an outside address, and `awk '{print $7; exit}'` prints that address, the seventh word of
the first line. `--apiserver-advertise-address` puts it in the apiserver's certificate, and
`--pod-network-cidr` gives the controller-manager the range to split between nodes:

```shell
ssh controlplane
CP_IP=$(ip route get 1.1.1.1 | awk '{print $7; exit}')
echo "$CP_IP"
sudo kubeadm init --apiserver-advertise-address "$CP_IP" --pod-network-cidr 10.244.0.0/16
```

`echo` prints `controlplane`'s address, such as `192.0.2.10`, which confirms the variable is set
before `init` uses it. `init` ends with the next steps and a join command:

```
Your Kubernetes control-plane has initialized successfully!

To start using your cluster, you need to run the following as a regular user:

  mkdir -p $HOME/.kube
  sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
  sudo chown $(id -u):$(id -g) $HOME/.kube/config
```

**Task 2.** `kubectl` reads `~/.kube/config` by default. `admin.conf` belongs to root, so copy
it with `sudo`, then make your user its owner:

```shell
mkdir -p ~/.kube
sudo cp /etc/kubernetes/admin.conf ~/.kube/config
sudo chown "$(id -u):$(id -g)" ~/.kube/config
k get nodes
```

The node answers without `sudo`, which confirms the kubeconfig works. It is `NotReady` because
there is no pod network yet:

```
NAME           STATUS     ROLES           AGE   VERSION
controlplane   NotReady   control-plane   3s    v1.34.12
```

**Task 3.** Flannel's manifest uses `10.244.0.0/16`, the range given to `init`, so it needs no
editing:

```shell
k apply -f https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml
k get nodes
k get pods -n kube-system -l k8s-app=kube-dns
```

Within a minute the node is `Ready`, and both CoreDNS pods are `Running`, which shows pods are
getting addresses from the pod network:

```
NAME           STATUS   ROLES           AGE   VERSION
controlplane   Ready    control-plane   33s   v1.34.12
NAME                       READY   STATUS    RESTARTS   AGE
coredns-66bc5c9577-cdzfp   1/1     Running   0          23s
coredns-66bc5c9577-rflwv   1/1     Running   0          23s
```

[Calico](../../references/pod-network.md#plugins) defaults to `192.168.0.0/16`, so its manifest would need an edit to match.

**Task 4.** The token in `init`'s join command expires after 24 hours, so print a new command,
then run it with `sudo` on each worker. Each worker is reached from `base`:

```shell
sudo kubeadm token create --print-join-command
exit                         # back to base
ssh node01
sudo kubeadm join 192.0.2.10:6443 --token y1nuhs.jhin9fvu35v68or6 --discovery-token-ca-cert-hash sha256:b5f60bdc9764b1c35860eeafa80bf46873414115c76ed911799eeca724decfb0
exit
ssh node02
sudo kubeadm join 192.0.2.10:6443 --token y1nuhs.jhin9fvu35v68or6 --discovery-token-ca-cert-hash sha256:b5f60bdc9764b1c35860eeafa80bf46873414115c76ed911799eeca724decfb0
exit
```

Use the command your cluster printed, since the token and hash differ. Each join ends with:

```
This node has joined the cluster:
* Certificate signing request was sent to apiserver and a response was received.
* The Kubelet was informed of the new secure connection details.
```

**Task 5.** The label key ends in `=` with nothing after it, an empty value. `ROLES` is built from
`node-role.kubernetes.io/<role>` labels:

```shell
ssh controlplane
k label node node01 node02 node-role.kubernetes.io/worker=
k get nodes
```

Both workers are `Ready` and show the role `worker`:

```
NAME           STATUS   ROLES           AGE   VERSION
controlplane   Ready    control-plane   55s   v1.34.12
node01         Ready    worker          10s   v1.34.12
node02         Ready    worker          9s    v1.34.12
```

**Task 6.**

```shell
k get pods -n kube-system
```

The four control plane pods end in `-controlplane`, there is one `kube-proxy` per node, and every
pod is `Running` with no restarts:

```
NAME                                   READY   STATUS    RESTARTS   AGE
coredns-66bc5c9577-cdzfp               1/1     Running   0          46s
coredns-66bc5c9577-rflwv               1/1     Running   0          46s
etcd-controlplane                      1/1     Running   0          54s
kube-apiserver-controlplane            1/1     Running   0          54s
kube-controller-manager-controlplane   1/1     Running   0          54s
kube-proxy-96h9t                       1/1     Running   0          10s
kube-proxy-hrtfh                       1/1     Running   0          46s
kube-proxy-tx4rz                       1/1     Running   0          11s
kube-scheduler-controlplane            1/1     Running   0          54s
```

</details>

## Check your work

Run these on `controlplane` as your normal user, without `sudo` on the `kubectl` lines.

1. All three nodes are Ready and the workers have the worker role:

   ```shell
   k get nodes
   ```

   ```
   NAME           STATUS   ROLES           AGE   VERSION
   controlplane   Ready    control-plane   87s   v1.34.10
   node01         Ready    worker          35s   v1.34.10
   node02         Ready    worker          35s   v1.34.10
   ```

2. The pod CIDR is the one you asked for:

   ```shell
   k get node controlplane -o jsonpath='{.spec.podCIDR}{"\n"}'
   ```

   ```
   10.244.0.0/24
   ```

3. The API server advertises the same address `ip route get 1.1.1.1` prints:

   ```shell
   sudo grep advertise-address /etc/kubernetes/manifests/kube-apiserver.yaml
   ```

   ```
       kubeadm.kubernetes.io/kube-apiserver.advertise-address.endpoint: 192.0.2.10:6443
       - --advertise-address=192.0.2.10
   ```

4. A CNI configuration exists:

   ```shell
   sudo ls /etc/cni/net.d/
   ```

   ```
   10-flannel.conflist
   ```

5. Every pod in `kube-system` is `Running`, including both CoreDNS pods and the four control
   plane pods:

   ```shell
   k get pods -n kube-system
   ```

## Further reading

* [Creating a cluster with kubeadm](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/create-cluster-kubeadm/)
  is the upstream version of these steps, including the options not used here.
* [kubeadm init](https://kubernetes.io/docs/reference/setup-tools/kubeadm/kubeadm-init/) and
  [kubeadm join](https://kubernetes.io/docs/reference/setup-tools/kubeadm/kubeadm-join/) are the
  full flag references for the two commands.
* [Kubernetes Components](https://kubernetes.io/docs/concepts/overview/components/) names every
  process in `k get pods -A` and says what each one is for.
