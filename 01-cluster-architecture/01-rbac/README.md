# Granting Permissions with RBAC

Role-based access control (RBAC) decides which requests the apiserver allows, by matching the
identity behind a request against the rules that have been bound to it. You have a working
three-node cluster, and a `kubectl` that can do absolutely anything to it.

In this lesson, you will build a second identity that starts with no permissions at all, grant
it exactly one thing, watch that grant stop at a namespace boundary, and then reach past the
boundary on purpose.

Nothing here schedules a pod, so nothing waits. Every step ends on a one-word answer from the
apiserver.

Exam domain: Cluster Architecture, Installation and Configuration (25%).

## Prerequisites

* The `built` snapshot, saved at the end of [00-kubeadm-install](../00-kubeadm-install/README.md).
  If you have none, run `lab/provision.sh --auto` and then `lab/snapshot.sh save built`.

## Lab setup

This exercise uses the `cluster` lab: a working three-node cluster.

1. From the Mac, in the repo root, restore the cluster and open a shell on `controlplane`:

   ```shell
   lab/snapshot.sh restore built
   limactl start controlplane && limactl start node01 && limactl start node02
   limactl shell controlplane
   ```

2. Create two namespaces, which stand in for two environments. Namespaced permissions are only
   worth reasoning about once there is more than one namespace:

   ```shell
   kubectl create namespace dev
   kubectl create namespace prod
   ```

   The output is similar to this:

   ```
   namespace/dev created
   namespace/prod created
   ```

## Objectives

* Find out why your own `kubectl` is allowed to do anything.
* Create a ServiceAccount that holds no permissions at all.
* Grant it one verb on one resource, with a Role and a RoleBinding.
* Watch the same request fail in a second namespace, and read the message that says why.
* Reuse a single ClusterRole definition across two namespaces.
* Reach a cluster-scoped resource, which a RoleBinding cannot do.

## Find out why your kubectl can do anything

1. Ask the apiserver who you are:

   ```shell
   kubectl auth whoami
   ```

   The output is similar to this:

   ```
   ATTRIBUTE                                           VALUE
   Username                                            kubernetes-admin
   Groups                                              [kubeadm:cluster-admins system:authenticated]
   ```

   You are not a Kubernetes object. `kubernetes-admin` is a name asserted by the client
   certificate in `~/.kube/config`, and `kubeadm:cluster-admins` is a group asserted by the
   same certificate. Neither exists as a resource you could delete.

2. Find the binding that gives that group its power:

   ```shell
   kubectl get clusterrolebinding kubeadm:cluster-admins -o wide
   ```

   The output is similar to this:

   ```
   NAME                     ROLE                        AGE     USERS   GROUPS                   SERVICEACCOUNTS
   kubeadm:cluster-admins   ClusterRole/cluster-admin   7d12h           kubeadm:cluster-admins
   ```

   The group is bound to `cluster-admin`, which permits everything. That binding is the only
   reason your commands work, and it is an ordinary object — the same kind you are about to
   create. Model and subject kinds: [rbac](../../references/rbac.md).

## Create an identity

A ServiceAccount is the one subject kind that exists as an object. Users and groups come from
credentials, so a cluster cannot hand you one; a ServiceAccount it can.

1. Create the account in `dev`:

   ```shell
   kubectl create serviceaccount deploy-bot -n dev
   ```

   The output is similar to this:

   ```
   serviceaccount/deploy-bot created
   ```

2. Ask what it is allowed to do. `kubectl auth can-i` asks the apiserver's authoriser directly,
   and `--as` impersonates without needing the subject's credentials. A ServiceAccount is named
   in full as `system:serviceaccount:<namespace>:<name>`:

   ```shell
   kubectl auth can-i list pods -n dev --as=system:serviceaccount:dev:deploy-bot
   ```

   The output is similar to this:

   ```
   no
   ```

   The account exists and can authenticate. It just cannot do anything, because permissions in
   Kubernetes are purely additive and it has been granted none. Existing and being allowed are
   separate.

> [!note]
> Bindings are not validated against their subjects. A binding that names a ServiceAccount
> which does not exist is created without complaint and grants nothing, so a typo in the name
> fails silently. Compare `kubectl get sa -n dev` against `kubectl describe rolebinding` when a
> grant appears to do nothing at all.

## Write a Role

A Role is a list of rules, each naming verbs and the resources those verbs apply to. It lives
in one namespace and can only ever name resources in that namespace.

1. Create the Role. `kubectl create role` writes the object without you writing YAML, which is
   what you want under exam time:

   ```shell
   kubectl create role pod-reader -n dev --verb=get,list,watch --resource=pods
   kubectl describe role pod-reader -n dev
   ```

   The output is similar to this:

   ```
   role.rbac.authorization.k8s.io/pod-reader created
   Name:         pod-reader
   Labels:       <none>
   Annotations:  <none>
   PolicyRule:
     Resources  Non-Resource URLs  Resource Names  Verbs
     ---------  -----------------  --------------  -----
     pods       []                 []              [get list watch]
   ```

   Note that `get`, `list` and `watch` are three separate verbs. Granting `get` does not let
   anyone `list`: `get` fetches one named object, `list` enumerates them, and `kubectl get pods`
   with no name needs `list`.

2. The Role names this exact verb on this exact resource. Ask again whether the answer has
   changed:

   ```shell
   kubectl auth can-i list pods -n dev --as=system:serviceaccount:dev:deploy-bot
   ```

   The output is similar to this:

   ```
   no
   ```

   Still `no`. A Role is a definition sitting in the namespace, attached to nobody. Nothing
   about creating it mentions `deploy-bot`, and RBAC never guesses at a subject. This is the
   single most common reason a permission that "looks right" does not work, and the check is
   always the same: look for a RoleBinding naming both the role and the subject.

## Bind the Role

A RoleBinding is the grant: it names one role and the subjects that get it.

1. Create the binding and ask again:

   ```shell
   kubectl create rolebinding deploy-bot-reads-pods -n dev \
     --role=pod-reader --serviceaccount=dev:deploy-bot
   kubectl auth can-i list pods -n dev --as=system:serviceaccount:dev:deploy-bot
   ```

   The output is similar to this:

   ```
   rolebinding.rbac.authorization.k8s.io/deploy-bot-reads-pods created
   yes
   ```

2. Read back the shape of what you just made, because the exam asks you to read these as often
   as write them:

   ```shell
   kubectl describe rolebinding deploy-bot-reads-pods -n dev
   ```

   The output is similar to this:

   ```
   Name:         deploy-bot-reads-pods
   Labels:       <none>
   Annotations:  <none>
   Role:
     Kind:  Role
     Name:  pod-reader
   Subjects:
     Kind            Name        Namespace
     ----            ----        ---------
     ServiceAccount  deploy-bot  dev
   ```

   One role, one subject list.

3. Confirm the grant stops at the verbs the Role named:

   ```shell
   kubectl auth can-i delete pods -n dev --as=system:serviceaccount:dev:deploy-bot
   ```

   The output is similar to this:

   ```
   no
   ```

## Cross a namespace boundary

`prod` exists and has pods-shaped permissions nowhere.

1. Ask the same question there:

   ```shell
   kubectl auth can-i list pods -n prod --as=system:serviceaccount:dev:deploy-bot
   ```

   The output is similar to this:

   ```
   no
   ```

   Both halves are namespaced, and both are in `dev`: the Role can only describe `dev`
   resources, and the RoleBinding only grants inside `dev`. The subject being a `dev`
   ServiceAccount is not what limits it — the binding's namespace is. Granting the same access
   in `prod` needs a second RoleBinding there, or a ClusterRoleBinding if it should apply
   everywhere.

2. A bare `no` hides which of the four parts of a rule failed. Impersonate a real request
   instead:

   ```shell
   kubectl get pods -n prod --as=system:serviceaccount:dev:deploy-bot
   ```

   The output is similar to this:

   ```
   Error from server (Forbidden): pods is forbidden: User "system:serviceaccount:dev:deploy-bot" cannot list resource "pods" in API group "" in the namespace "prod"
   ```

   Subject, verb, resource, API group, namespace — the message names every field a rule has to
   match. When a permission fails and you cannot see why, this is the command that tells you,
   and `""` is the core API group, not a missing value.

> [!note]
> `cannot list resource "deployments" in API group ""` means the rule was written against the
> core group, but Deployments live in `apps`. Pass `--resource=deployments.apps`. The Forbidden
> message always names the group the request actually needed, which is why it is worth reading
> rather than skimming.

## Reuse one definition in two namespaces

Granting the same read access in a third and fourth namespace by writing a Role in each is how
the object count gets away from you. A ClusterRole is a definition with no namespace, and a
RoleBinding is allowed to point at one.

1. Write the definition once and bind it twice:

   ```shell
   kubectl create clusterrole configmap-reader --verb=get,list --resource=configmaps
   kubectl create rolebinding deploy-bot-reads-configmaps -n dev \
     --clusterrole=configmap-reader --serviceaccount=dev:deploy-bot
   kubectl create rolebinding deploy-bot-reads-configmaps -n prod \
     --clusterrole=configmap-reader --serviceaccount=dev:deploy-bot
   kubectl auth can-i list configmaps -n dev --as=system:serviceaccount:dev:deploy-bot
   kubectl auth can-i list configmaps -n prod --as=system:serviceaccount:dev:deploy-bot
   ```

   The output is similar to this:

   ```
   clusterrole.rbac.authorization.k8s.io/configmap-reader created
   rolebinding.rbac.authorization.k8s.io/deploy-bot-reads-configmaps created
   rolebinding.rbac.authorization.k8s.io/deploy-bot-reads-configmaps created
   yes
   yes
   ```

2. One definition, two grants. The ClusterRole did not make the permission cluster-wide — the
   RoleBinding still scopes it to its own namespace, which a third namespace proves:

   ```shell
   kubectl auth can-i list configmaps -n kube-system --as=system:serviceaccount:dev:deploy-bot
   ```

   The output is similar to this:

   ```
   no
   ```

This combination is worth recognising on sight: **ClusterRole bound by RoleBinding** means a
reusable definition applied per namespace, and it is how the built-in `view`, `edit` and
`admin` roles are meant to be used.

## Reach a cluster-scoped resource

Nodes are not in a namespace.

1. Try to grant access to them the way that has worked so far:

   ```shell
   kubectl create clusterrole node-reader --verb=get,list --resource=nodes
   kubectl create rolebinding deploy-bot-reads-nodes -n dev \
     --clusterrole=node-reader --serviceaccount=dev:deploy-bot
   kubectl auth can-i list nodes --as=system:serviceaccount:dev:deploy-bot
   ```

   The output is similar to this:

   ```
   clusterrole.rbac.authorization.k8s.io/node-reader created
   rolebinding.rbac.authorization.k8s.io/deploy-bot-reads-nodes created
   Warning: resource 'nodes' is not namespace scoped

   no
   ```

   kubectl says the quiet part out loud. The ClusterRole grants node access, and the
   RoleBinding grants it *in `dev`* — but there is no such thing as a node in `dev`, so the
   grant applies to nothing. A RoleBinding scopes to a namespace, and a cluster-scoped resource
   has no namespace to be scoped into. The binding is legal and does nothing.

2. The only binding without a namespace is a ClusterRoleBinding:

   ```shell
   kubectl create clusterrolebinding deploy-bot-reads-nodes \
     --clusterrole=node-reader --serviceaccount=dev:deploy-bot
   kubectl auth can-i list nodes --as=system:serviceaccount:dev:deploy-bot
   ```

   The output is similar to this:

   ```
   clusterrolebinding.rbac.authorization.k8s.io/deploy-bot-reads-nodes created
   Warning: resource 'nodes' is not namespace scoped

   yes
   ```

3. Read back everything the account accumulated:

   ```shell
   kubectl auth can-i --list -n dev --as=system:serviceaccount:dev:deploy-bot
   ```

   The output is similar to this:

   ```
   Resources                                       Non-Resource URLs                      Resource Names   Verbs
   selfsubjectreviews.authentication.k8s.io        []                                     []               [create]
   selfsubjectaccessreviews.authorization.k8s.io   []                                     []               [create]
   selfsubjectrulesreviews.authorization.k8s.io    []                                     []               [create]
   pods                                            []                                     []               [get list watch]
   configmaps                                      []                                     []               [get list]
   nodes                                           []                                     []               [get list]
                                                   [/.well-known/openid-configuration/]   []               [get]
                                                   [/.well-known/openid-configuration]    []               [get]
                                                   [/api/*]                               []               [get]
                                                   [/api]                                 []               [get]
                                                   [/apis/*]                              []               [get]
                                                   [/apis]                                []               [get]
                                                   [/healthz]                             []               [get]
                                                   [/healthz]                             []               [get]
                                                   [/livez]                               []               [get]
                                                   [/livez]                               []               [get]
                                                   [/openapi/*]                           []               [get]
                                                   [/openapi]                             []               [get]
                                                   [/openid/v1/jwks/]                     []               [get]
                                                   [/openid/v1/jwks]                      []               [get]
                                                   [/readyz]                              []               [get]
                                                   [/readyz]                              []               [get]
                                                   [/version/]                            []               [get]
                                                   [/version/]                            []               [get]
                                                   [/version]                             []               [get]
                                                   [/version]                             []               [get]
   ```

   The three rows you created are `pods`, `configmaps` and `nodes` — four bindings across two
   namespaces, collapsed into the list of what the subject can actually do. `can-i --list` is
   the fastest way to audit a subject.

   Everything else in that table was there before you started. The `selfsubjectreviews` rows
   come from `system:basic-user`, which lets any subject ask what it can do, and the
   `/healthz` and `/version` rows from `system:public-info-viewer`. Every authenticated
   subject gets both, which is why a brand-new ServiceAccount is never truly empty.

4. See how much of this the cluster already came with:

   ```shell
   kubectl get clusterrole --no-headers | wc -l
   kubectl get clusterrole --no-headers | grep -v '^system:'
   ```

   The output is similar to this:

   ```
   73
   admin                                                                  2026-08-02T10:49:07Z
   cluster-admin                                                          2026-08-02T10:49:07Z
   configmap-reader                                                       2026-08-09T23:14:15Z
   edit                                                                   2026-08-02T10:49:07Z
   flannel                                                                2026-08-02T22:38:35Z
   kubeadm:get-nodes                                                      2026-08-02T10:49:08Z
   node-reader                                                            2026-08-09T23:14:15Z
   view                                                                   2026-08-02T10:49:07Z
   ```

   Sixty-five of the seventy-three carry the `system:` prefix and wire the control plane to
   the apiserver. Of the eight left, two are the ones you just wrote and two belong to
   components — `flannel` from the pod network, `kubeadm:get-nodes` from the bootstrap. That
   leaves four meant for humans: `cluster-admin`, `admin`, `edit` and `view`. Reading one
   before writing your own is usually faster than writing your own.

## Recall

Answer before opening.

<details><summary>A Role and a RoleBinding both exist and the subject still cannot act. What is left?</summary>

The four fields of the rule: verb, resource, API group, namespace. Impersonate a
real request with `--as` and read the Forbidden message, which names all four.
Most often the verb (`get` does not imply `list`) or the API group.
</details>

<details><summary>What does a RoleBinding pointing at a ClusterRole grant?</summary>

The ClusterRole's permissions, inside the RoleBinding's namespace only. The
ClusterRole is being reused as a definition, not applied cluster-wide.
</details>

<details><summary>Why can't a ClusterRoleBinding reference a Role?</summary>

A Role's rules are scoped to its own namespace, so there is nothing coherent to
grant cluster-wide. The pairing only crosses in the other direction.
</details>

<details><summary>How do you take a permission away?</summary>

Delete the binding. There are no deny rules — permissions are purely additive, so
a subject can act if any binding allows it.
</details>

<details><summary>Which subject kinds have no object in the cluster?</summary>

Users and groups. Both are names asserted by whatever authenticated the request,
so a binding can reference a user that no one can create or delete.
</details>

<details><summary>Fastest way to see everything a ServiceAccount can do in a namespace?</summary>

`kubectl auth can-i --list -n <ns> --as=system:serviceaccount:<ns>:<name>`.
</details>

<details><summary>Why does your own kubectl have full access?</summary>

`admin.conf`'s certificate authenticates as `kubernetes-admin` in the group
`kubeadm:cluster-admins`, and the ClusterRoleBinding of the same name binds that
group to `cluster-admin`.
</details>

## Cleaning up

Hand the cluster back the way you found it. From the Mac, in the repo root:

```shell
lab/snapshot.sh restore built
```

## What's next

* [rbac](../../references/rbac.md) has the object model, the subject kinds and the full
  rule-resolution order in one place.
* [Using RBAC Authorization](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)
  is the reference for every field of a Role, a ClusterRole and both bindings.
* [ServiceAccounts](https://kubernetes.io/docs/concepts/security/service-accounts/) covers
  how the subject you created authenticates, and how a pod gets one.
* [Authorization](https://kubernetes.io/docs/reference/access-authn-authz/authorization/)
  explains where RBAC sits among the other authorizers a request passes through.
