# Labs

Each exercise starts from one of these labs. Starting a lab resets all four machines, so nothing needs cleaning up after an exercise.

The first lab you ever start builds the machines, which takes about 6 minutes. The first start of any other lab sets it up on top of the lab it builds on, which takes a few minutes more. Every later start of a lab takes under a minute.

## Machines

| Machine | Role | Address |
| --- | --- | --- |
| `base` | Where you start, as in the exam. It has no Kubernetes tools; you `ssh` from it to the others. | `192.168.104.2` |
| `controlplane` | Control plane. Almost all work happens here. | `192.168.104.10` |
| `node01` | Worker | `192.168.104.11` |
| `node02` | Worker | `192.168.104.12` |

The cluster runs Kubernetes 1.34, one version behind the exam's 1.35, so the cluster-upgrade exercise can upgrade it to exactly the exam's version. Every machine has passwordless `sudo`.

Reach the machine a step or task names with `ssh`:

```shell
ssh controlplane   # or node01, node02
sudo -i            # root, when the task needs it
exit               # back to base (twice after sudo -i)
```

Go back to `base` before moving to another machine. ssh from one of `controlplane`, `node01` and `node02` to another is refused, as in the exam.

`kubectl` works only on `controlplane`. On a worker it fails with `localhost:8080 was refused`. `k` is an alias for `kubectl` with bash completion, as in the exam.
