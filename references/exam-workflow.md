# Exam workflow

The exam is 15 to 20 tasks in 2 hours on remote Linux hosts, with a terminal, vim, Firefox and the allowed docs. Only the final state is graded, with partial credit per sub-task ([Linux Foundation tips](https://docs.linuxfoundation.org/tc-docs/certification/tips-cka-and-ckad) (not available in the exam)). The fastest correct path wins, so the habits below matter as much as the Kubernetes. [EXAM.md](../EXAM.md) has the sources.

## Hosts and ssh

You start on a machine named `base`, which has no `kubectl`, `k`, `yq` or other exam tools. Each task opens with a box naming the host to `ssh` into, and all the task's work happens there. Work on the wrong host scores nothing for that task.

```bash
ssh node01      # from base, reach the host a task names
sudo -i         # root, for files under /etc, /opt or /var, or systemctl
exit            # leave root; exit again to go back to base
```

- `kubectl` needs a kubeconfig. On a host without one it fails with `The connection to the server localhost:8080 was refused`. A task on a worker is about that machine's files and services.
- Nested ssh, such as `ssh node02` from `node01`, is not supported. Go back to `base` first.
- Each task is a new session. An alias, an exported variable or a `.vimrc` you set is gone in the next task.

The lab works the same way: you start on `base`, and `ssh controlplane`, `ssh node01` and `ssh node02` work only from there ([lab](../lab/README.md#moving-between-machines)).

## The k alias and short names

Every exam host has `k` as an alias for `kubectl`, with bash completion. Tab completes commands, resource types, object names and namespaces after `-n`.

Short names save typing, and `k api-resources` lists them all ([kubectl quick reference](https://kubernetes.io/docs/reference/kubectl/quick-reference/#resource-types)):

| Type | Short name |
| --- | --- |
| pods, deployments, services | `po`, `deploy`, `svc` |
| configmaps, namespaces, serviceaccounts | `cm`, `ns`, `sa` |
| persistentvolumes, persistentvolumeclaims, storageclasses | `pv`, `pvc`, `sc` |
| networkpolicies, nodes | `netpol`, `no` |

Secrets have none.

## Generating YAML

`--dry-run=client -o yaml` prints the object a command would create, and creates nothing ([creating objects](https://kubernetes.io/docs/reference/kubectl/quick-reference/#creating-objects)). Apply the output directly, or redirect it to a file and edit it first.

```bash
k run web --image=nginx:1.27 --dry-run=client -o yaml > pod.yaml
k create deployment web --image=nginx:1.27 --replicas=2 --dry-run=client -o yaml > deploy.yaml
k expose deployment web --port=80 --dry-run=client -o yaml            # the Deployment must exist
k create service clusterip web --tcp=80:80 --dry-run=client -o yaml
k create configmap cfg --from-literal=MODE=fast --dry-run=client -o yaml
k create secret generic sec --from-literal=TOKEN=abc123 --dry-run=client -o yaml
k create namespace dev --dry-run=client -o yaml
k create serviceaccount bot --dry-run=client -o yaml
k create role r --verb=get,list --resource=pods --dry-run=client -o yaml
k create rolebinding rb --role=r --serviceaccount=dev:bot --dry-run=client -o yaml
k create job once --image=busybox:1.37 --dry-run=client -o yaml -- date
k create cronjob tick --image=busybox:1.37 --schedule="*/5 * * * *" --dry-run=client -o yaml -- date
k create ingress web --rule="example.com/=web:80" --dry-run=client -o yaml
```

What `kubectl create` fills in by itself:

- `k create deployment` labels the pods `app: <name>` and names the container after the image, such as `nginx` for `nginx:1.27`. `k create service clusterip <name>` selects `app: <name>`, so the two match when the names match.
- `k create secret generic` base64-encodes each value. Written by hand under `data`, a plain value is rejected with `illegal base64 data`.

## Snippets from the docs

No `kubectl create` command writes a NetworkPolicy, a PersistentVolume, a PersistentVolumeClaim or a StorageClass. Copy one from the docs instead. The kubernetes.io search box is allowed, but opening a result outside the allowed sites is not. Many examples have a copy button, and some pages give a ready-to-paste `cat <<EOF` block:

| Need | Page and section |
| --- | --- |
| NetworkPolicy | [Network Policies: the NetworkPolicy resource](https://kubernetes.io/docs/concepts/services-networking/network-policies/#networkpolicy-resource) and [default deny all ingress traffic](https://kubernetes.io/docs/concepts/services-networking/network-policies/#default-deny-all-ingress-traffic) |
| PersistentVolume, PersistentVolumeClaim | [Persistent Volumes: persistent volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/#persistent-volumes) and [PersistentVolumeClaims](https://kubernetes.io/docs/concepts/storage/persistent-volumes/#persistentvolumeclaims) |
| StorageClass | [Storage Classes: StorageClass objects](https://kubernetes.io/docs/concepts/storage/storage-classes/#storageclass-objects) |
| Ingress | [Ingress: the Ingress resource](https://kubernetes.io/docs/concepts/services-networking/ingress/#the-ingress-resource) |
| kustomization, overlay, generator | [Kustomize: bases and overlays](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/#bases-and-overlays) and [configMapGenerator](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/#configmapgenerator) |
| etcd backup and restore commands | [Operating etcd clusters: backing up](https://kubernetes.io/docs/tasks/administer-cluster/configure-upgrade-etcd/#backing-up-an-etcd-cluster) |
| kubeadm upgrade commands | [Upgrading kubeadm clusters](https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-upgrade/#upgrading-control-plane-nodes) |

After pasting, change the names, the namespace and the values the task gives. Leave everything else as the docs wrote it.

## vim for YAML

The exam blocks the INSERT key, so enter insert mode with `i`.

| Keys | Does |
| --- | --- |
| `:set paste`, then `i`, then paste | Pastes without re-indenting each line. Without it, vim can indent every line one step further than the one above. |
| `Esc`, `:wq` | Leaves insert mode, saves and quits. `:q!` quits without saving. |
| `dd`, `u` | Deletes a line. Undoes. |
| `V`, move, `>` or `<` | Selects lines and shifts them right or left by one indent. |
| `:set et sw=2 ts=2` | Indents with two spaces instead of a tab, which YAML requires. |

Paste in the exam terminal is Ctrl+Shift+V, and copy is Ctrl+Shift+C. In Firefox they are Ctrl+V and Ctrl+C.

## kubectl explain

`k explain <type>.<field>` prints a field's type and description from the cluster's own schema, and `--recursive` prints the whole subtree with the same nesting as the YAML ([kubectl explain](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_explain/)). Use it when you know a field exists but not where it goes:

```bash
k explain pod.spec.containers.resources
k explain deploy.spec.strategy --recursive
```

## Changing live objects

```bash
k set image deploy/web nginx=nginx:1.28     # container name, then image
k scale deploy web --replicas=3
k label deploy web tier=frontend            # tier- removes it
k annotate deploy web note=hi
k set env deploy/web MODE=fast
k edit deploy web                           # opens the live object in vim
k replace --force -f /tmp/kubectl-edit-….yaml
```

Most of a running pod's spec cannot change ([pod update and replacement](https://kubernetes.io/docs/concepts/workloads/pods/#pod-update-and-replacement)). `k edit` on such a field fails with `pods "<name>" is invalid`, and it saves your edit to a file under `/tmp` and prints its name. `k replace --force -f <that file>` deletes the pod and creates it from your copy. A Deployment's pods are replaced by a rollout instead, so edit the Deployment, not its pods.

## Checking your work

Read back the exact value the task asked for, the way a grader would:

```bash
k get deploy web -o jsonpath='{.spec.replicas} {.spec.template.spec.containers[0].image}{"\n"}'
k get deploy web -o yaml | grep -A3 resources
k describe deploy web | grep -E '^Replicas|Image'
k auth can-i list pods --as=system:serviceaccount:dev:bot -n dev
```

`jsonpath` examples are in the [quick reference](https://kubernetes.io/docs/reference/kubectl/quick-reference/#formatting-output).

## Failure modes

| Symptom | Cause |
| --- | --- |
| `The connection to the server localhost:8080 was refused` | `kubectl` on a host without a kubeconfig. Run it on the host the task names for cluster work. |
| `Command 'kubectl' not found` or `k: command not found` | You are still on `base`. `ssh` to the host the task names first. |
| `Error from server (NotFound): deployments.apps "web" not found` from `k expose … --dry-run=client` | `expose` reads the object from the cluster. Create it first, or use `k create service`. |
| `Secret in version "v1" cannot be handled as a Secret: illegal base64 data at input byte 4` | A plain value under a Secret's `data`. Use `k create secret generic --from-literal`, or put it under `stringData`. |
| `error: pods "tool" is invalid`, then `A copy of your changes has been stored to "/tmp/kubectl-edit-….yaml"` | The field cannot change on a running pod. `k replace --force -f` that file. |
| `error parsing stair.yaml: error converting YAML to JSON: yaml: line 7: mapping values are not allowed in this context` | vim indented the paste. Undo, `:set paste`, paste again. |

## Docs

- [kubectl Quick Reference](https://kubernetes.io/docs/reference/kubectl/quick-reference/)
- [kubectl explain](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_explain/)
- [Linux Foundation: tips for the CKA](https://docs.linuxfoundation.org/tc-docs/certification/tips-cka-and-ckad) (not available in the exam)
- [Linux Foundation: resources allowed](https://docs.linuxfoundation.org/tc-docs/certification/certification-resources-allowed) (not available in the exam)
