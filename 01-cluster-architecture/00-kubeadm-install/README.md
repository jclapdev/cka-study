# Bootstrapping a Cluster with kubeadm

`kubeadm` turns machines that already have a container runtime and a kubelet into a working
Kubernetes cluster. It generates the certificates, writes the control plane's static pod
manifests, and hands you a command that joins other machines to what it built.

There are three Ubuntu VMs with containerd, kubelet, kubeadm and kubectl already installed:
`controlplane`, `node01`, `node02`. In this lesson, you will initialise the cluster on
`controlplane`, give it a pod network, join the other two as workers, and end with three nodes
that can all schedule pods.

Exam domain: Cluster Architecture, Installation and Configuration (25%).

## Prerequisites

* lima installed and the VMs built once with `lab/provision.sh`. See [lab/README.md](../../lab/README.md).

## Lab setup

This exercise uses the `vms` lab: three bare VMs with no cluster.

From the Mac, in the repo root, reset the VMs to bare machines with no cluster, start them, and
open a shell on `controlplane`:

```shell
lab/snapshot.sh restore clean
limactl start controlplane && limactl start node01 && limactl start node02
limactl shell controlplane
```

Every command below runs on `controlplane` unless it says otherwise.

## Objectives

* See why a kubelet with no cluster cannot start, and why `kubectl` cannot reach anything.
* Initialise a control plane with `kubeadm init` and understand what it wrote.
* Find out how the apiserver can be a pod before there is an apiserver to create it.
* Install a pod network and watch the node go Ready.
* Join two workers with a token you generate yourself.
* Label the workers and confirm the whole control plane is healthy.

## Check what is already running

1. Check the state of the kubelet:

   ```shell
   systemctl status kubelet
   ```

   The line to read is similar to this:

   ```
   Active: activating (auto-restart) (Result: exit-code)
   ```

   `activating (auto-restart)` is the kubelet crash-looping on purpose.
   It is installed and enabled, but it is not joined to a cluster, so it has no configuration to
   run from and exits immediately. `kubeadm init` writes that configuration.

2. Try to talk to a cluster that does not exist yet:

   ```shell
   kubectl get nodes
   ```

   The output is similar to this:

   ```
   The connection to the server localhost:8080 was refused - did you specify the right host or port?
   ```

   There is no [kubeconfig](../../references/kubeconfig.md) yet, so
   kubectl fell back to its built-in default of `localhost:8080` instead of naming a real
   cluster.

## Initialise the control plane

`kubeadm init` writes an address into the apiserver's certificate and into every kubeconfig it
generates, and the workers are later told to trust that exact address. A wrong one is not
fixable without `kubeadm reset`.

1. Get `controlplane`'s address and keep it in a variable, so it is never retyped:

   ```shell
   CP_IP=$(ip route get 1.1.1.1 | awk '{print $7; exit}'); echo "$CP_IP"
   ```

   The output is similar to this:

   ```
   192.168.104.5
   ```

   The address must be the one the other nodes can reach. In this lab that is the
   `192.168.104.x` address; [lab/README.md](../../lab/README.md#problems-specific-to-this-lab) explains the
   second address that looks valid and is not.

2. Initialise the cluster:

   ```shell
   sudo kubeadm init --apiserver-advertise-address "$CP_IP" --pod-network-cidr 10.244.0.0/16
   ```

   It prints sixty-odd progress lines over about a minute. The last lines are similar to this:

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

   kubeadm join 192.168.104.5:6443 --token 1xu2ib.xi17odn5olqok8q0 \
   	--discovery-token-ca-cert-hash sha256:0c31ec322c5540482c5b4761be53dab760a474c462ab22a14a3013f6689001b8
   ```

   Behind those progress lines, `kubeadm init` did five things:

   * Ran preflight checks — swap, ports, container runtime — and refused to go on if any failed.
   * Generated a CA and certificates under `/etc/kubernetes/pki/`.
   * Wrote a kubeconfig for each control plane component, plus `/etc/kubernetes/admin.conf` for
     you.
   * Dropped static pod manifests in `/etc/kubernetes/manifests/` and waited for the kubelet to
     start them.
   * Printed the `kubeadm join` line above, whose token is good for 24 hours.

> [!note]
> If `kubeadm init` stops on a preflight check, the cause is almost always swap being on, port
> 6443 already taken, or an `/etc/kubernetes` left over from an earlier attempt.
> `sudo kubeadm reset -f` clears the leftovers and is the safe first move before any re-run.

### If pods are created through the apiserver, how did the apiserver pod start?

List the manifests `init` dropped:

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
start it. Diagram and consequences: [control-plane](../../references/control-plane.md), and
[Static Pods](https://kubernetes.io/docs/concepts/workloads/pods/#static-pods) upstream.

Because these pods are files, editing one restarts that component in seconds, and
`kubectl delete pod kube-apiserver-controlplane` does nothing lasting — the kubelet recreates
it from the file.

## Point kubectl at the cluster

`kubeadm init` wrote an admin kubeconfig to `/etc/kubernetes/admin.conf`, owned by root, and
kubectl looks in `~/.kube/config`. Copying it across fixes the `localhost:8080` error. The
`chown` matters: leave the file root-owned and plain `kubectl` still cannot read it.

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
controlplane   NotReady   control-plane   12s   v1.34.10
```

One node, and it is **not** Ready. That is expected at this point, and the next section is why.

> [!note]
> `The connection to the server localhost:8080 was refused` coming back later means no readable
> kubeconfig again: either you are root through `sudo` and reading root's home instead of yours,
> or you are on a worker, which never gets an admin kubeconfig. Re-run this step as your normal
> user.

## Install a pod network

### Why is controlplane NotReady when all four control plane pods are running?

Check the node, the pods, and the CNI configuration directory:

```shell
kubectl describe node controlplane | grep -A3 'Ready '
kubectl get pods -n kube-system
sudo ls /etc/cni/net.d/
```

The output is similar to this:

```
  Ready            False   Sun, 09 Aug 2026 19:17:03 -0400   Sun, 09 Aug 2026 19:17:00 -0400   KubeletNotReady              container runtime network not ready: NetworkReady=false reason:NetworkPluginNotReady message:Network plugin returns error: cni plugin not initialized
Addresses:
  InternalIP:  192.168.104.5
  Hostname:    controlplane
NAME                                   READY   STATUS    RESTARTS   AGE
coredns-66bc5c9577-6v6q2               0/1     Pending   0          2s
coredns-66bc5c9577-jpswk               0/1     Pending   0          2s
etcd-controlplane                      1/1     Running   0          9s
kube-apiserver-controlplane            0/1     Running   0          10s
kube-controller-manager-controlplane   0/1     Running   0          9s
kube-proxy-4spt8                       1/1     Running   0          2s
kube-scheduler-controlplane            0/1     Running   0          9s
```

`cni plugin not initialized`, both CoreDNS pods `Pending`, and `/etc/cni/net.d/` printing
nothing at all. Three symptoms of one cause.

Kubernetes needs a network plugin to give pods IPs, and kubeadm installs none. Until you
install one the kubelet will not call the node Ready, and CoreDNS gets no address, because a
pod that cannot be given an IP cannot be scheduled. This halfway state is expected. What the
plugin has to provide and the three ranges that must not overlap:
[pod-network](../../references/pod-network.md).

1. Install flannel. It defaults to `10.244.0.0/16`, the CIDR you gave `init`:

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

2. Watch the node flip to Ready, which takes under a minute, then stop the watch with `Ctrl-C`:

   ```shell
   kubectl get nodes -w
   ```

   The output is similar to this:

   ```
   NAME           STATUS   ROLES           AGE   VERSION
   controlplane   Ready    control-plane   34s   v1.34.10
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
   coredns-66bc5c9577-6v6q2               0/1     ContainerCreating   0          24s
   coredns-66bc5c9577-jpswk               0/1     ContainerCreating   0          24s
   etcd-controlplane                      1/1     Running             0          31s
   kube-apiserver-controlplane            1/1     Running             0          32s
   kube-controller-manager-controlplane   1/1     Running             0          31s
   kube-proxy-4spt8                       1/1     Running             0          24s
   kube-scheduler-controlplane            1/1     Running             0          31s
   ```

   The config file flannel wrote is what the kubelet was waiting for. CoreDNS is out of
   `Pending` and passes through `ContainerCreating` for a few seconds before it reaches
   `Running`.

> [!note]
> If the nodes stay `NotReady` after a CNI is applied, the plugin's pod CIDR disagrees with the
> `--pod-network-cidr` given to `init`. Flannel defaults to `10.244.0.0/16` and needs no edit;
> Calico defaults to `192.168.0.0/16` and does. Both allocations have to name the same range.
> CoreDNS still `Pending` is the same fault seen from the other end — check `/etc/cni/net.d/`
> before looking at CoreDNS itself.

## Join the workers

The join line printed by `init` is still in your scroll-back, but its token expires after 24
hours. Learn to regenerate it instead.

1. On `controlplane`, list the existing token and print a fresh join command:

   ```shell
   sudo kubeadm token list
   sudo kubeadm token create --print-join-command
   ```

   The output is similar to this:

   ```
   TOKEN                     TTL         EXPIRES                USAGES                   DESCRIPTION                                                EXTRA GROUPS
   1xu2ib.xi17odn5olqok8q0   23h         2026-08-10T23:17:02Z   authentication,signing   The default bootstrap token generated by 'kubeadm init'.   system:bootstrappers:kubeadm:default-node-token
   kubeadm join 192.168.104.5:6443 --token 2iufap.h79fzwmh6zdzn3ee --discovery-token-ca-cert-hash sha256:0c31ec322c5540482c5b4761be53dab760a474c462ab22a14a3013f6689001b8
   ```

   The hash proves the apiserver to the joining node; the token proves the node to the
   apiserver, long enough for it to get a client certificate signed. Sequence diagram:
   [workers](../../references/workers.md).

2. In a second terminal on your Mac, open a shell on `node01` and run the command you just
   printed. Your token and hash differ from the ones above, so paste yours:

   ```shell
   limactl shell node01
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

> [!note]
> A `kubeadm join` that times out means the worker cannot reach the advertise address on port
> 6443, almost always because `init` was given the wrong address. It is not fixable from the
> worker; run `sudo kubeadm reset -f` and re-run `init` on `controlplane`.

Workers get no admin kubeconfig, so `kubectl` on `node01` fails with the same `localhost:8080`
error. Run every `kubectl` command from `controlplane`.

## Label the workers

Back on `controlplane`.

1. List the nodes:

   ```shell
   kubectl get nodes
   ```

   The output is similar to this:

   ```
   NAME           STATUS   ROLES           AGE   VERSION
   controlplane   Ready    control-plane   69s   v1.34.10
   node01         Ready    <none>          22s   v1.34.10
   node02         Ready    <none>          13s   v1.34.10
   ```

   The workers show `<none>` under ROLES. A node object has no role field; the ROLES column is
   rendered from any label named `node-role.kubernetes.io/<role>`. kubeadm sets that label on
   `controlplane` itself and leaves the workers unlabelled.

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
   controlplane   Ready    control-plane   69s   v1.34.10
   node01         Ready    worker          22s   v1.34.10
   node02         Ready    worker          13s   v1.34.10
   ```

   Both now read `worker`. The empty value after `=` is the convention.

## Check the control plane

List everything the cluster is running:

```shell
kubectl get pods -A -o wide
```

The output is similar to this, with the columns this section does not discuss removed:

```
NAMESPACE      NAME                                   STATUS    IP              NODE
kube-flannel   kube-flannel-ds-bw6rq                  Running   192.168.104.7   node02
kube-flannel   kube-flannel-ds-m47t8                  Running   192.168.104.6   node01
kube-flannel   kube-flannel-ds-nvnjs                  Running   192.168.104.5   controlplane
kube-system    coredns-66bc5c9577-6v6q2               Running   10.244.0.2      controlplane
kube-system    coredns-66bc5c9577-jpswk               Running   10.244.0.3      controlplane
kube-system    etcd-controlplane                      Running   192.168.104.5   controlplane
kube-system    kube-apiserver-controlplane            Running   192.168.104.5   controlplane
kube-system    kube-controller-manager-controlplane   Running   192.168.104.5   controlplane
kube-system    kube-proxy-4spt8                       Running   192.168.104.5   controlplane
kube-system    kube-proxy-6shmq                       Running   192.168.104.6   node01
kube-system    kube-proxy-wkb6n                       Running   192.168.104.7   node02
kube-system    kube-scheduler-controlplane            Running   192.168.104.5   controlplane
```

Static pods are named `<component>-<node>`, so `etcd-controlplane`,
`kube-apiserver-controlplane` and so on. `kube-proxy` appears once per node, and so does
`kube-flannel-ds` — both are DaemonSets. Flannel installs into its own `kube-flannel`
namespace, so `-n kube-system` misses it entirely, which is worth remembering the first time a
network plugin looks like it did not install.

The two CoreDNS pods carry `10.244.x` addresses from the pod CIDR, while everything else
carries the node's own address, because the control plane components and both DaemonSets run
on the host network.

Nothing should be `CrashLoopBackOff`, `Error` or `Pending`. Which question each of those calls
for: [pod](../../references/pod.md).

## Recall

Answer before opening.

<details><summary>Why can the apiserver be a pod?</summary>

Static pods. The kubelet starts anything it finds in `/etc/kubernetes/manifests/`
without consulting an apiserver, so the control plane does not depend on the
cluster already existing.
</details>

<details><summary>Why must the CNI's pod CIDR match --pod-network-cidr?</summary>

The controller-manager hands each node a slice of the CIDR given to `init` and
records it in `spec.podCIDR`; the CNI hands out addresses from its own
configuration. Disagreement means pods get addresses nothing routes to.
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

The one the other nodes route to. Here that is `controlplane`'s `192.168.104.x`
address from `ip route get 1.1.1.1`. It ends up in the apiserver's
certificate and in every join command, so a wrong choice is not fixable without a
reset.
</details>

## Practice it

Do it again without the steps above, the way the exam asks. Give yourself **25 minutes**.

Reset to bare VMs first, from the Mac:

```shell
lab/snapshot.sh restore clean
limactl start controlplane && limactl start node01 && limactl start node02
```

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
`192.168.0.0/16` and costs an edit.

</details>

## Check your work

Run these on `controlplane` as your normal user, without `sudo` on the `kubectl` lines.

1. All three nodes are Ready and the workers have the worker role:

   ```shell
   kubectl get nodes
   ```

   ```
   NAME           STATUS   ROLES           AGE   VERSION
   controlplane   Ready    control-plane   5m    v1.34.10
   node01         Ready    worker          3m    v1.34.10
   node02         Ready    worker          3m    v1.34.10
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

## Clean up

Keep this cluster. Later exercises use it as the `cluster` lab. From the Mac:

```shell
lab/snapshot.sh save built
```

## What's next

* [Creating a cluster with kubeadm](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/create-cluster-kubeadm/)
  is the upstream version of what you just did, including the options this lesson did not use.
* [kubeadm init](https://kubernetes.io/docs/reference/setup-tools/kubeadm/kubeadm-init/) and
  [kubeadm join](https://kubernetes.io/docs/reference/setup-tools/kubeadm/kubeadm-join/) are the
  full flag references for the two commands the lesson turns on.
* [Kubernetes Components](https://kubernetes.io/docs/concepts/overview/components/) names every
  process you saw in `kubectl get pods -A` and says what each one is for.
