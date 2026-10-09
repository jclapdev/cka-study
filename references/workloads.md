# Workloads

A Deployment runs a set number of identical pods and keeps that number running. [Pods](pod.md) are rarely created on their own: a pod that dies is gone, while a pod that a Deployment owns is replaced. A Deployment also replaces its pods gradually when their spec changes ([Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)).

## Deployments and ReplicaSets

A Deployment doesn't create pods itself. It creates a ReplicaSet, and the ReplicaSet creates the pods. A ReplicaSet is an object whose only job is to keep `replicas` pods matching its selector running. The names show the chain: Deployment `web`, ReplicaSet `web-66d47686b4`, pod `web-66d47686b4-wgsjk`. The middle part is a hash of the [pod template](#the-pod-template) ([pod-template-hash label](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#pod-template-hash-label)).

```
NAME                  READY   UP-TO-DATE   AVAILABLE   AGE   CONTAINERS   IMAGES       SELECTOR
deployment.apps/web   2/2     2            2           15s   nginx        nginx:1.27   app=web

NAME                             DESIRED   CURRENT   READY   AGE   CONTAINERS   IMAGES       SELECTOR
replicaset.apps/web-66d47686b4   2         2         2       15s   nginx        nginx:1.27   app=web,pod-template-hash=66d47686b4

NAME                       READY   STATUS    RESTARTS   AGE   IP           NODE     NOMINATED NODE   READINESS GATES
pod/web-66d47686b4-wgsjk   1/1     Running   0          15s   10.244.1.2   node01   <none>           <none>
pod/web-66d47686b4-z9t5h   1/1     Running   0          15s   10.244.2.2   node02   <none>           <none>
```

Deleting one of these pods makes the ReplicaSet create a new one with a new name within seconds. To remove the pods for good, delete or scale the Deployment. `kubectl describe` shows each object's owner as `Controlled By: ReplicaSet/web-66d47686b4` on a pod and `Controlled By: Deployment/web` on the ReplicaSet.

A ReplicaSet can be created on its own from a [manifest](kubectl.md#generating-yaml), since no `kubectl create` command writes one. The docs recommend a Deployment instead, because a Deployment can also replace its pods with a new version ([Deployment (recommended)](https://kubernetes.io/docs/concepts/workloads/controllers/replicaset/#deployment-recommended)).

## The pod template

The pod template is the part of a Deployment, under `spec.template`, that describes the pods to create: their [labels](labels.md) and their containers ([pod templates](https://kubernetes.io/docs/concepts/workloads/pods/#pod-templates)). The Deployment's `spec.selector` must match the template's labels. `kubectl create deployment` writes both:

```yaml
spec:
  replicas: 1
  selector:
    matchLabels:
      app: x
  template:
    metadata:
      labels:
        app: x
    spec:
      containers:
      - image: nginx:1.27
        name: nginx
```

Changing anything under `template` starts a [rollout](#rollouts). Changing `replicas` only adds or removes pods.

## Rollouts

A rollout is the replacement of a Deployment's pods after its pod template changes. The Deployment creates a new ReplicaSet and moves pods from the old one to the new one a few at a time, so the application keeps serving ([updating a Deployment](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#updating-a-deployment)). The old ReplicaSet stays, scaled to 0, so `kubectl rollout undo` can go back to it. Each rollout is a revision.

After `kubectl set image deploy/web nginx=nginx:1.28`:

```
NAME             DESIRED   CURRENT   READY   AGE
web-66d47686b4   0         0         0       36s
web-fbdc6fc8c    2         2         2       17s
```

## Other workload kinds

| Kind | Runs | Use it for |
| --- | --- | --- |
| Deployment | a number of interchangeable pods | web servers and other stateless applications |
| StatefulSet | pods with fixed names (`db-0`, `db-1`) and their own storage each, started in order | databases and other applications where each copy keeps its own data ([StatefulSets](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/)) |
| [DaemonSet](daemonsets.md) | one pod on each node | node agents such as [kube-proxy](control-plane.md#components) |
| Job | pods until one finishes successfully, then stops | one-off tasks such as a migration ([Jobs](https://kubernetes.io/docs/concepts/workloads/controllers/job/)) |
| CronJob | a Job on a schedule | backups and other repeated tasks |

A CronJob's schedule uses the five fields of Linux cron: minute, hour, day of month, month and day of week. `0 2 * * *` means 02:00 every day ([schedule syntax](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/#schedule-syntax)).

```
NAME             STATUS     COMPLETIONS   DURATION   AGE
job.batch/once   Complete   1/1           3s         3s

NAME                    SCHEDULE    TIMEZONE   SUSPEND   ACTIVE   LAST SCHEDULE   AGE
cronjob.batch/nightly   0 2 * * *   <none>     False     0        <none>          3s
```

A finished Job's pod stays with `STATUS` `Completed`, so its logs can still be read.

## Commands

```bash
kubectl create deployment web --image nginx:1.27 --replicas 2
kubectl scale deployment web --replicas 4
kubectl set image deployment/web nginx=nginx:1.28     # <container>=<image>, starts a rollout
kubectl rollout status deployment/web
kubectl rollout history deployment/web
kubectl rollout undo deployment/web
kubectl create job once --image busybox:1.36 -- echo done
kubectl create cronjob nightly --image busybox:1.36 --schedule "0 2 * * *" -- echo hi
```

## Docs

- [Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [ReplicaSet](https://kubernetes.io/docs/concepts/workloads/controllers/replicaset/)
- [StatefulSets](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/)
- [Jobs](https://kubernetes.io/docs/concepts/workloads/controllers/job/)
- [CronJob](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/)
