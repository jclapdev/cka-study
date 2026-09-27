# Bootstrapping a Cluster with kubeadm

`kubeadm` turns machines that already have a container runtime and a kubelet into a working
Kubernetes cluster. It generates the certificates, writes the control plane's static pod
manifests, and prints a command that joins other machines to what it built.

Exam domain: Cluster Architecture, Installation and Configuration (25%).

Starts from the [`vms` lab](../../lab/README.md#vms). Every command runs on `controlplane` unless a step says otherwise.

## Objectives

* See why a kubelet with no cluster cannot start, and why `kubectl` cannot reach anything.
* Initialise a control plane with `kubeadm init` and read what it wrote.
* Find out how the apiserver can be a pod before there is an apiserver to create it.
* Install a pod network and watch the node go Ready.
* Join two workers with a token you generate yourself.
* Label the workers and confirm the whole control plane is healthy.

## Check what is already running

The machines have the Kubernetes tools installed but no cluster:
[the kubelet before init or join](../../references/workers.md#the-kubelet-before-init-or-join).

1. Check the state of the kubelet:

   ```shell
   systemctl status kubelet
   ```

   The line to read is similar to this:

   ```
   Active: activating (auto-restart) (Result: exit-code)
   ```

   The kubelet is installed and enabled, but it has no configuration file yet, so it exits at
   once and systemd restarts it every 10 seconds. `sudo journalctl -u kubelet` shows the
   missing file: [the kubelet before init or join](../../references/workers.md#the-kubelet-before-init-or-join).

2. Try to talk to a cluster that does not exist yet:

   ```shell
   kubectl get nodes
   ```

   The last line of the output is similar to this:

   ```
   The connection to the server localhost:8080 was refused - did you specify the right host or port?
   ```

   There is no [kubeconfig](../../references/kubeconfig.md#resolution-order) yet, so kubectl used its built-in
   default of `localhost:8080`.

## Initialise the control plane

`kubeadm init` writes the control plane's address into the apiserver's certificate and into
every kubeconfig it generates, and the workers are later told to trust that exact address. A
wrong one is not fixable without `kubeadm reset`: [the advertise address](../../references/kubeadm.md#the-advertise-address).

1. Get `controlplane`'s address and keep it in a variable:

   ```shell
   CP_IP=$(ip route get 1.1.1.1 | awk '{print $7; exit}'); echo "$CP_IP"
   ```

   The output is similar to this:

   ```
   192.168.104.5
   ```

   The address must be one the other nodes can reach. `ip route get` prints the address the
   machine uses to reach other networks, which on a machine with more than one address is the
   one to advertise.

2. Initialise the cluster:

   ```shell
   sudo kubeadm init --apiserver-advertise-address "$CP_IP" --pod-network-cidr 10.244.0.0/16
   ```

   It prints 84 lines over about 90 seconds. The last lines are similar to this:

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

   kubeadm join 192.168.104.5:6443 --token x45qeh.cckxlv7xjht0wp4g \
   	--discovery-token-ca-cert-hash sha256:3e70b1b90336a52dde3e0ea7103a3e0ed5e94012f60c8a5936d56003736e6dee
   ```

   Each progress line starts with the phase that printed it, such as `[preflight]`, `[certs]`,
   `[kubeconfig]` or `[addons]`. What each phase does and the files it leaves:
   [what kubeadm init does](../../references/kubeadm.md#what-kubeadm-init-does).

> [!note]
> If `kubeadm init` stops with `[ERROR Port-6443]: Port 6443 is in use` or `[ERROR
> FileAvailable--etc-kubernetes-manifests-kube-apiserver.yaml]`, a control plane from an earlier
> attempt is still there. `sudo kubeadm reset -f` removes it. Swap being on only gives a
> preflight warning, and `init` fails later at `wait-control-plane`:
> [kubeadm failure modes](../../references/kubeadm.md#failure-modes).

### If pods are created through the apiserver, how did the apiserver pod start?

List the manifests `init` wrote:

```shell
sudo ls /etc/kubernetes/manifests/
```

The output is similar to this:

```
etcd.yaml
kube-apiserver.yaml
kube-controller-manager.yaml
kube-scheduler.yaml
```

The kubelet watches that directory and starts whatever it finds there, without asking an
apiserver or a scheduler. That is how the control plane starts before there is a cluster to
start it. Because these pods come from files, editing one restarts that component within
seconds, and `kubectl delete pod` on one does nothing lasting, because the kubelet recreates it
from the file: [static pods](../../references/control-plane.md#static-pods).

## Point kubectl at the cluster

`kubeadm init` wrote an admin kubeconfig to `/etc/kubernetes/admin.conf`, owned by root with
mode `600`, and kubectl looks in `~/.kube/config`. Without the `chown`, the copy stays
root-owned and kubectl fails with `permission denied`:
[on a kubeadm cluster](../../references/kubeconfig.md#on-a-kubeadm-cluster).

Copy the admin kubeconfig into your home directory:

```shell
mkdir -p ~/.kube
sudo cp /etc/kubernetes/admin.conf ~/.kube/config
sudo chown "$(id -u):$(id -g)" ~/.kube/config
kubectl get nodes
```

The output is similar to this:

```
NAME           STATUS     ROLES           AGE   VERSION
controlplane   NotReady   control-plane   15s   v1.34.10
```

The node is `NotReady` until a pod network is installed.

> [!note]
> `The connection to the server localhost:8080 was refused` coming back later means kubectl found
> no kubeconfig. Either you ran it with `sudo`, which reads root's home instead of yours, or you
> are on a worker, which has no admin kubeconfig. Run it as your normal user on `controlplane`.

## Install a pod network

Kubernetes needs a network plugin to give pods addresses, and kubeadm installs none. What the
plugin provides and the three address ranges that must not overlap:
[three CIDRs, not one](../../references/pod-network.md#three-cidrs-not-one).

### Why is controlplane NotReady when all four control plane pods are running?

Check the node, the pods, and the CNI configuration directory:

```shell
kubectl describe node controlplane | grep -A3 'Ready '
kubectl get pods -n kube-system
sudo ls /etc/cni/net.d/
```

The output is similar to this:

```
  Ready            False   Sun, 27 Sep 2026 17:14:37 -0400   Sun, 27 Sep 2026 17:14:34 -0400   KubeletNotReady              container runtime network not ready: NetworkReady=false reason:NetworkPluginNotReady message:Network plugin returns error: cni plugin not initialized
Addresses:
  InternalIP:  192.168.104.5
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
node `NotReady`. A `NotReady` node carries the taint `node.kubernetes.io/not-ready:NoSchedule`,
which CoreDNS does not tolerate, so both CoreDNS pods stay `Pending`:
[pods on a new cluster](../../references/pod.md#on-a-new-cluster).

1. Install Flannel. It defaults to `10.244.0.0/16`, the CIDR you gave `init`:

   ```shell
   kubectl apply -f https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml
   ```

   The output is similar to this:

   ```
   namespace/kube-flannel created
   serviceaccount/flannel created
   clusterrole.rbac.authorization.k8s.io/flannel created
   clusterrolebinding.rbac.authorization.k8s.io/flannel created
   configmap/kube-flannel-cfg created
   daemonset.apps/kube-flannel-ds created
   ```

2. Watch the node change to Ready, which takes about 20 seconds, then stop the watch with
   `Ctrl-C`:

   ```shell
   kubectl get nodes -w
   ```

   The output is similar to this:

   ```
   NAME           STATUS   ROLES           AGE   VERSION
   controlplane   Ready    control-plane   43s   v1.34.10
   ```

3. Confirm what changed on disk and in `kube-system`:

   ```shell
   sudo ls /etc/cni/net.d/
   kubectl get pods -n kube-system
   ```

   The output is similar to this:

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
> `ContainerCreating`. `kubectl logs -n kube-flannel -l app=flannel` names the mismatch:
> [three CIDRs, not one](../../references/pod-network.md#three-cidrs-not-one).

## Join the workers

The join line printed by `init` contains a token that expires after 24 hours. `kubeadm token
create --print-join-command` prints a new one: [joining](../../references/workers.md#joining).

1. On `controlplane`, list the existing token and print a fresh join command:

   ```shell
   sudo kubeadm token list
   sudo kubeadm token create --print-join-command
   ```

   The output is similar to this:

   ```
   TOKEN                     TTL         EXPIRES                USAGES                   DESCRIPTION                                                EXTRA GROUPS
   x45qeh.cckxlv7xjht0wp4g   23h         2026-09-28T21:14:37Z   authentication,signing   The default bootstrap token generated by 'kubeadm init'.   system:bootstrappers:kubeadm:default-node-token
   kubeadm join 192.168.104.5:6443 --token 0llpfd.430vs5tnv5zfrcxq --discovery-token-ca-cert-hash sha256:3e70b1b90336a52dde3e0ea7103a3e0ed5e94012f60c8a5936d56003736e6dee
   ```

   The hash lets the joining node check that it reached the right apiserver. The token lets
   the apiserver accept the node for long enough to sign a client certificate for it. The
   sequence: [joining](../../references/workers.md#joining).

2. On `node01`, run the command you just printed. Your token and hash differ from the ones
   above, so paste yours:

   ```shell
   sudo kubeadm join ...        # the command printed in the previous step
   ```

   The last lines are similar to this:

   ```
   This node has joined the cluster:
   * Certificate signing request was sent to apiserver and a response was received.
   * The Kubelet was informed of the new secure connection details.

   Run 'kubectl get nodes' on the control-plane to see this node join the cluster.
   ```

3. Join `node02` the same way, from a shell on `node02`.

Workers get no admin kubeconfig, so `kubectl` on `node01` fails with the same `localhost:8080`
error. Run every `kubectl` command on `controlplane`.

## Label the workers

A node's role is a [label](../../references/labels.md#keys-and-values), not a field. Back on `controlplane`:

1. List the nodes:

   ```shell
   kubectl get nodes
   ```

   The output is similar to this:

   ```
   NAME           STATUS   ROLES           AGE   VERSION
   controlplane   Ready    control-plane   87s   v1.34.10
   node01         Ready    <none>          35s   v1.34.10
   node02         Ready    <none>          35s   v1.34.10
   ```

   The ROLES column is built from labels named `node-role.kubernetes.io/<role>`. kubeadm sets
   that label on `controlplane` and none on the workers:
   [roles](../../references/workers.md#roles).

2. Add the worker label to both:

   ```shell
   kubectl label node node01 node02 node-role.kubernetes.io/worker=
   kubectl get nodes
   ```

   The output is similar to this:

   ```
   node/node01 labeled
   node/node02 labeled
   NAME           STATUS   ROLES           AGE   VERSION
   controlplane   Ready    control-plane   87s   v1.34.10
   node01         Ready    worker          35s   v1.34.10
   node02         Ready    worker          35s   v1.34.10
   ```

   The value after `=` is empty. The role name comes from the key.

## Check the control plane

List everything the cluster is running:

```shell
kubectl get pods -A -o wide
```

The output is similar to this, with the columns this section does not discuss removed:

```
NAMESPACE      NAME                                   STATUS            IP              NODE
kube-flannel   kube-flannel-ds-2plsz                  Running           192.168.104.6   node01
kube-flannel   kube-flannel-ds-fwbdp                  Running           192.168.104.5   controlplane
kube-flannel   kube-flannel-ds-mzw4c                  PodInitializing   192.168.104.7   node02
kube-system    coredns-66bc5c9577-7s2xq               Running           10.244.0.3      controlplane
kube-system    coredns-66bc5c9577-wst66               Running           10.244.0.2      controlplane
kube-system    etcd-controlplane                      Running           192.168.104.5   controlplane
kube-system    kube-apiserver-controlplane            Running           192.168.104.5   controlplane
kube-system    kube-controller-manager-controlplane   Running           192.168.104.5   controlplane
kube-system    kube-proxy-4wdrl                       Running           192.168.104.5   controlplane
kube-system    kube-proxy-7ghxx                       Running           192.168.104.7   node02
kube-system    kube-proxy-k7lwp                       Running           192.168.104.6   node01
kube-system    kube-scheduler-controlplane            Running           192.168.104.5   controlplane
```

Static pods are named `<component>-<node>`, such as `etcd-controlplane`. `kube-proxy` and
`kube-flannel-ds` each have one pod per node, because both are
[DaemonSets](../../references/daemonsets.md). Flannel installs into its own
[namespace](../../references/namespaces.md), `kube-flannel`, so `-n kube-system` does not show
it. `PodInitializing` means that pod's init containers are still running.

The two CoreDNS pods have `10.244.x` addresses from the pod CIDR. Every other pod has its node's
own address, because the control plane pods and both DaemonSets use the host network:
[pods on the host network](../../references/pod-network.md#pods-on-the-host-network).

When the cluster is healthy, no pod is `CrashLoopBackOff`, `Error` or `Pending`. What each of
those means: [phases](../../references/pod.md#phases).

## Recall

Answer before opening.

<details><summary>Why can the apiserver be a pod?</summary>

Static pods. The kubelet starts anything it finds in `/etc/kubernetes/manifests/`
without consulting an apiserver, so the control plane does not depend on the
cluster already existing.
</details>

<details><summary>Why must the CNI's pod CIDR match --pod-network-cidr?</summary>

The controller-manager gives each node a slice of the CIDR given to `init` and
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

The CA cert hash proves the apiserver to the joining node. The bootstrap token
proves the node to the apiserver, for just long enough to get a client
certificate signed. It expires in 24 hours;
`kubeadm token create --print-join-command` makes a new one.
</details>

<details><summary>Which address goes in --apiserver-advertise-address?</summary>

The one the other nodes can reach, which `ip route get 1.1.1.1` prints. It ends up in the apiserver's
certificate and in every join command, so a wrong choice is not fixable without a
reset.
</details>

## Practice it

Do it again without the steps above, the way the exam asks. Give yourself **25 minutes**.

Start from a fresh [`vms` lab](../../lab/README.md#vms).

1. **Host `controlplane`, weight 19%.** Initialise a control plane with pod network CIDR
   `10.244.0.0/16`. The API server must advertise `controlplane`'s own IPv4 address.
2. **Host `controlplane`, weight 12%.** Configure kubectl for your non-root user so that
   `kubectl get nodes` works without `sudo` and without setting `KUBECONFIG`.
3. **Host `controlplane`, weight 19%.** Install a CNI plugin that matches the pod CIDR, so that
   `controlplane` is `Ready` and CoreDNS is running.
4. **Hosts `controlplane`, `node01`, `node02`, weight 25%.** Join `node01` and `node02` as
   workers. Both must be `Ready`.
5. **Host `controlplane`, weight 12%.** Label both workers with `node-role.kubernetes.io/worker=`.
6. **Host `controlplane`, weight 13%.** Make sure `kube-apiserver`, `kube-controller-manager`,
   `kube-scheduler` and `etcd` are `Running`, and no pod in `kube-system` is in
   `CrashLoopBackOff`.

<details><summary>Solution</summary>

```shell
# 1. on controlplane
CP_IP=$(ip route get 1.1.1.1 | awk '{print $7; exit}')
sudo kubeadm init --apiserver-advertise-address "$CP_IP" --pod-network-cidr 10.244.0.0/16

# 2.
mkdir -p ~/.kube
sudo cp /etc/kubernetes/admin.conf ~/.kube/config
sudo chown "$(id -u):$(id -g)" ~/.kube/config

# 3.
kubectl apply -f https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml

# 4. print the join command, then run it with sudo on node01 and node02
sudo kubeadm token create --print-join-command

# 5.
kubectl label node node01 node02 node-role.kubernetes.io/worker=

# 6.
kubectl get pods -n kube-system
```

Flannel defaults to `10.244.0.0/16`, so its manifest needs no editing. Calico defaults to
`192.168.0.0/16`, so its manifest needs an edit.

</details>

## Check your work

Run these on `controlplane` as your normal user, without `sudo` on the `kubectl` lines.

1. All three nodes are Ready and the workers have the worker role:

   ```shell
   kubectl get nodes
   ```

   ```
   NAME           STATUS   ROLES           AGE   VERSION
   controlplane   Ready    control-plane   87s   v1.34.10
   node01         Ready    worker          35s   v1.34.10
   node02         Ready    worker          35s   v1.34.10
   ```

2. The pod CIDR is the one you asked for:

   ```shell
   kubectl get node controlplane -o jsonpath='{.spec.podCIDR}{"\n"}'
   ```

   ```
   10.244.0.0/24
   ```

3. The API server advertises the same address `ip route get 1.1.1.1` prints:

   ```shell
   sudo grep advertise-address /etc/kubernetes/manifests/kube-apiserver.yaml
   ```

   ```
       kubeadm.kubernetes.io/kube-apiserver.advertise-address.endpoint: 192.168.104.5:6443
       - --advertise-address=192.168.104.5
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
   kubectl get pods -n kube-system
   ```

## What's next

* [Creating a cluster with kubeadm](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/create-cluster-kubeadm/)
  is the upstream version of these steps, including the options not used here.
* [kubeadm init](https://kubernetes.io/docs/reference/setup-tools/kubeadm/kubeadm-init/) and
  [kubeadm join](https://kubernetes.io/docs/reference/setup-tools/kubeadm/kubeadm-join/) are the
  full flag references for the two commands.
* [Kubernetes Components](https://kubernetes.io/docs/concepts/overview/components/) names every
  process in `kubectl get pods -A` and says what each one is for.
