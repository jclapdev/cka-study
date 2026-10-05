# Labels

A label is a key-value pair on an object, such as `node-role.kubernetes.io/worker=` on a node. Labels have no effect on their own. Other things select objects by them: `kubectl get -l`, a [Service](services.md) choosing its pods, a node selector choosing nodes ([labels and selectors](https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/)).

## Keys and values

A key has an optional prefix and a name, separated by `/`. Prefixes such as `kubernetes.io/` are reserved for Kubernetes components ([syntax and character set](https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/#syntax-and-character-set)). A value can be empty, which `kubectl` writes as `key=`.

## In this lab

[kubeadm](kubeadm.md) puts these labels on `controlplane`:

```
beta.kubernetes.io/arch=arm64,beta.kubernetes.io/os=linux,kubernetes.io/arch=arm64,kubernetes.io/hostname=controlplane,kubernetes.io/os=linux,node-role.kubernetes.io/control-plane=,node.kubernetes.io/exclude-from-external-load-balancers=
```

The ROLES column of `kubectl get nodes` is built from `node-role.kubernetes.io/<role>` labels. See [workers](workers.md).

## Commands

```bash
kubectl get nodes --show-labels
kubectl label node node01 node02 node-role.kubernetes.io/worker=   # add, empty value
kubectl label node node02 node-role.kubernetes.io/worker-          # remove: key followed by -
kubectl label node node01 disk=hdd --overwrite                     # change an existing value
kubectl get nodes -l node-role.kubernetes.io/worker                # select by key
kubectl get pods -l app=web,tier!=db                               # select by value
```

## Failure modes

| Symptom | Cause |
| --- | --- |
| `error: 'node-role.kubernetes.io/worker' already has a value (), and --overwrite is false` | The key exists. Add `--overwrite` to change its value. |
| A selector matches nothing | The key or value differs, often by case or by a missing prefix. Compare with `--show-labels`. |

## Docs

- [Labels and selectors](https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/)
- [Well-known labels, annotations and taints](https://kubernetes.io/docs/reference/labels-annotations-taints/)
- [`kubectl label`](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_label/)
