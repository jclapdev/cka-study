# How Helm works

An application in Kubernetes is rarely one object. A web app is a Deployment, a Service, a ConfigMap, a ServiceAccount and often more, and `kubectl apply` treats each of them as separate. Nothing records that these objects belong together, which version of the app they are, or what they looked like before the last change. A Deployment keeps its own rollout history, but a ConfigMap or a Service keeps none, so undoing a bad change means finding and reverting every file by hand.

Helm adds three things on top of `kubectl`. It packages an application's manifests as a chart that anyone can install. It lets one chart serve many installs through values, the settings each install changes. It keeps a numbered history of every install, so the whole application can be upgraded, rolled back or removed as one unit ([what Helm can do](https://helm.sh/docs/intro/introduction/#what-can-helm-do)).

## How it works

A chart is a folder of templates, which are Kubernetes manifests with gaps in them, plus a `values.yaml` file that fills each gap with a default ([the chart file structure](https://helm.sh/docs/topics/charts/#the-chart-file-structure)). A chart repository is a web server that hosts charts and an `index.yaml` listing them and their versions. A release is an installed copy of a chart, with its own name, in a namespace.

When you run `helm install`, everything up to the last step happens on your own machine. Helm merges the chart's defaults with the values you give, fills in the templates, and sends the finished manifests to the apiserver. It then saves a record of the release (the chart, the values and the manifests) as a Secret in the release's namespace.

```mermaid
sequenceDiagram
  participant You
  participant Helm as helm (your machine)
  participant Repo as chart repository
  participant API as apiserver
  You->>Helm: helm install web podinfo/podinfo --set replicaCount=2
  Helm->>Repo: download the chart version
  Helm->>Helm: merge values, fill in the templates
  Helm->>API: apply the Deployment, Service and other objects
  Helm->>API: create Secret sh.helm.release.v1.web.v1
  API-->>You: release "web", revision 1, deployed
  Note over API: The Deployment's controller creates the pods, as it would after kubectl apply
```

Each later upgrade or rollback renders the chart again and adds the next revision, stored as one more Secret. A rollback never deletes history. It creates a new revision that repeats the chart and values of an older one.

```mermaid
flowchart LR
  R[repository<br/>index.yaml] -->|helm repo add / update| C[chart version]
  C --> I[helm install]
  V[values:<br/>chart defaults<br/>+ -f file<br/>+ --set] --> I
  I --> REL[release revision 1<br/>objects + Secret v1]
  REL -->|helm upgrade| REL2[revision 2]
  REL2 -->|helm rollback 1| REL3[revision 3<br/>= chart and values of 1]
```

## How it fits in the cluster

Helm has no part running inside the cluster. It is a command-line tool that talks to the apiserver with the same kubeconfig as `kubectl`, the file that holds the cluster's address and your credential, so it can do only what that kubeconfig's user is allowed to do ([architecture](https://helm.sh/docs/intro/introduction/#architecture), [RBAC](../references/rbac.md)).

Helm creates objects and then stops. It does not watch them afterwards. The Deployment's controller, not Helm, creates and replaces the pods. If someone edits an object with `kubectl`, Helm does not notice until the next upgrade. An operator, a program that runs in the cluster and manages objects of its own types, is different: it keeps correcting its objects ([CRDs and operators](../references/crds.md)).

Kustomize solves a similar problem in a different way. It is built into `kubectl`, it changes plain YAML with patches instead of filling in templates, and it keeps no release history ([Kustomize](../references/kustomize.md)). Use Helm to install software someone else packaged as a chart, and use Kustomize to keep variants of your own manifests.

The commands, the rules for values, and the error messages are on the [Helm reference page](../references/helm.md).

## Further reading

- [Introduction to Helm](https://helm.sh/docs/intro/introduction/)
- [Charts](https://helm.sh/docs/topics/charts/)
- [Helm 4 overview](https://helm.sh/docs/overview/)
- [Changes since Helm 2](https://helm.sh/docs/faq/changes_since_helm2/)
- [Server-side apply](https://kubernetes.io/docs/reference/using-api/server-side-apply/)
