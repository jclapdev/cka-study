# Granting Permissions with RBAC

Role-based access control (RBAC) decides which requests the apiserver allows, by matching the
identity behind a request against the rules that have been bound to it.

Starts from the [`cluster` lab](../../lab/README.md#cluster). Every command runs on `controlplane`, reached with `ssh controlplane` from `base`.

## Objectives

* Find out why your own `kubectl` is allowed to do anything.
* Create a ServiceAccount that holds no permissions at all.
* Grant it one verb on one resource, with a Role and a RoleBinding.
* Watch the same request fail in a second namespace, and read the message that says why.
* Reuse a single ClusterRole definition across two namespaces.
* Reach a cluster-scoped resource, which a RoleBinding cannot do.

## Create two namespaces

A namespace is a named group of objects, and the boundary a Role and a RoleBinding apply
within: [namespaces](../../references/namespaces.md).

1. Create two:

   ```shell
   kubectl create namespace dev
   kubectl create namespace prod
   ```

   The output is similar to this:

   ```
   namespace/dev created
   namespace/prod created
   ```

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
   same certificate. Neither exists as a resource you could delete. How a certificate becomes
   a user and groups: [client certificates](../../references/authentication.md#client-certificates).

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
   reason your commands work, and it is an ordinary object of the same kind you are about to
   create: [the model](../../references/rbac.md#the-model) and [subjects](../../references/rbac.md#subjects).

## Create an identity

A ServiceAccount is the one subject kind that exists as an object. Users and groups come from
credentials, so a cluster cannot create them. It can create a ServiceAccount:
[the ServiceAccount model](../../references/service-accounts.md#the-model).

1. Create the account in `dev`:

   ```shell
   kubectl create serviceaccount deploy-bot -n dev
   ```

   The output is similar to this:

   ```
   serviceaccount/deploy-bot created
   ```

2. Ask what it is allowed to do. `kubectl auth can-i` asks the apiserver's authoriser directly,
   and `--as` impersonates without needing the subject's credentials
   ([impersonation](../../references/authentication.md#commands)). A ServiceAccount is named in full as
   `system:serviceaccount:<namespace>:<name>`:

   ```shell
   kubectl auth can-i list pods -n dev --as=system:serviceaccount:dev:deploy-bot
   ```

   The output is similar to this:

   ```
   no
   ```

   The account exists and can authenticate, but it cannot do anything, because permissions in
   Kubernetes are purely additive and it has been granted none
   ([subjects](../../references/rbac.md#subjects)).

> [!note]
> Bindings are not validated against their subjects. A binding that names a ServiceAccount
> which does not exist is created without complaint and grants nothing, so a typo in the name
> fails silently. Compare `kubectl get sa -n dev` against `kubectl describe rolebinding` when a
> grant appears to do nothing at all.

## Write a Role

A Role is a list of rules, each naming verbs and the resources those verbs apply to. It lives
in one namespace and can only ever name resources in that namespace:
[the model](../../references/rbac.md#the-model).

1. Create the Role. `kubectl create role` writes the object without you writing YAML:

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

   Still `no`. A Role is a definition attached to nobody. Nothing about creating it mentions
   `deploy-bot`, and RBAC never guesses at a subject. When a Role looks right and still grants
   nothing, look for a RoleBinding that names both the Role and the subject.

## Bind the Role

A RoleBinding is the grant. It names one role and the subjects that get it:
[the model](../../references/rbac.md#the-model).

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

2. Read back what you just made:

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

3. Confirm the grant stops at the verbs the Role named:

   ```shell
   kubectl auth can-i delete pods -n dev --as=system:serviceaccount:dev:deploy-bot
   ```

   The output is similar to this:

   ```
   no
   ```

## Cross a namespace boundary

1. Ask the same question in `prod`:

   ```shell
   kubectl auth can-i list pods -n prod --as=system:serviceaccount:dev:deploy-bot
   ```

   The output is similar to this:

   ```
   no
   ```

   Both halves are namespaced, and both are in `dev`: the Role can only describe `dev`
   resources, and the RoleBinding only grants inside `dev`. The subject being a `dev`
   ServiceAccount is not what limits it. The binding's namespace is. Granting the same access
   in `prod` needs a second RoleBinding there, or a ClusterRoleBinding if it should apply
   everywhere: [namespaced and cluster-scoped resources](../../references/namespaces.md#namespaced-and-cluster-scoped-resources).

2. A bare `no` hides which part of the rule failed. Impersonate a real request instead:

   ```shell
   kubectl get pods -n prod --as=system:serviceaccount:dev:deploy-bot
   ```

   The output is similar to this:

   ```
   Error from server (Forbidden): pods is forbidden: User "system:serviceaccount:dev:deploy-bot" cannot list resource "pods" in API group "" in the namespace "prod"
   ```

   The message names every field a rule has to match: subject, verb, resource, API group and
   namespace. `""` is the core API group, not a missing value:
   [where the group matters](../../references/api-groups.md#where-the-group-matters).

> [!note]
> The Forbidden message names the group the request needed. If it says `in API group "apps"`
> and your hand-written Role has `apiGroups: [""]`, the rule matches nothing.
> `kubectl create role --resource=deployments` fills in `apps` for you.

## Reuse one definition in two namespaces

A ClusterRole is a definition with no namespace, and a RoleBinding is allowed to point at one.
So a ClusterRole can be written once and bound in as many namespaces as needed, instead of a
Role in each: [the model](../../references/rbac.md#the-model).

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

2. The ClusterRole did not make the permission cluster-wide. Each RoleBinding still scopes it
   to its own namespace, which a third namespace shows:

   ```shell
   kubectl auth can-i list configmaps -n kube-system --as=system:serviceaccount:dev:deploy-bot
   ```

   The output is similar to this:

   ```
   no
   ```

A ClusterRole bound by a RoleBinding is a reusable definition applied per namespace. The
built-in `view`, `edit` and `admin` roles are meant to be used this way.

## Reach a cluster-scoped resource

Nodes are not in a namespace. They are cluster-scoped, like PersistentVolumes and namespaces
themselves: [namespaced and cluster-scoped resources](../../references/namespaces.md#namespaced-and-cluster-scoped-resources).

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

   The ClusterRole grants node access, and the RoleBinding grants it *in `dev`*. There is no
   such thing as a node in `dev`, so the grant applies to nothing. A RoleBinding scopes to a
   namespace, and a cluster-scoped resource has no namespace to be scoped into. The binding is
   legal and does nothing.

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

   The three rows you created are `pods`, `configmaps` and `nodes`. They come from four
   bindings across two namespaces, collapsed into one list of what the subject can do.

   Everything else in that table was there before you started, and every authenticated
   subject gets it. The three `self…reviews` rows come from `system:basic-user`, which lets a
   subject ask what it is and what it may do. The `/api`, `/apis` and `/openapi` rows come
   from `system:discovery`, and the `/healthz`, `/livez`, `/readyz` and `/version` rows from
   `system:public-info-viewer`. These paths are non-resource URLs:
   [RBAC in this lab](../../references/rbac.md#in-this-lab).

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

   65 of the 73 carry the `system:` prefix and let the control plane components talk to the
   apiserver. Of the 8 left, 2 are the ones you just wrote, `flannel` belongs to the pod
   network, and `kubeadm:get-nodes` to the bootstrap. That leaves 4 meant for people:
   `cluster-admin`, `admin`, `edit` and `view`.

## Quiz

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

## Practice

Do it again without the steps above, the way the exam asks. Give yourself **15 minutes**.

Start from a fresh [`cluster` lab](../../lab/README.md#cluster). When time is up,
[grade the run](../../lab/README.md#grading).

1. **Host `controlplane`, weight 15%.** Create the namespace `web` and a ServiceAccount `ci` in
   it.
2. **Host `controlplane`, weight 25%.** Create a Role `deployer` in `web` that allows only
   `create`, `update` and `delete` on Deployments, and bind it to `ci` with a RoleBinding
   `ci-deployer`.
3. **Host `controlplane`, weight 20%.** Create one ClusterRole `secret-reader` that allows `get`
   and `list` on Secrets. Use it so that `ci` can read Secrets in `web` and `default` but not in
   any other namespace. Name each binding `ci-secret-reader`.
4. **Host `controlplane`, weight 20%.** Allow `ci` to `list` PersistentVolumes, with a
   ClusterRole `pv-lister` and a ClusterRoleBinding `ci-pv-lister`.
5. **Host `controlplane`, weight 20%.** Give the group `auditors` the built-in `view` role in
   `web` only, with a RoleBinding `auditors-view`.

<details><summary>Solution</summary>

```shell
ssh controlplane
# 1.
k create namespace web
k create serviceaccount ci -n web

# 2. kubectl fills in the apps group for deployments
k create role deployer -n web --verb=create,update,delete --resource=deployments
k create rolebinding ci-deployer -n web --role=deployer --serviceaccount=web:ci

# 3. one ClusterRole, one RoleBinding per namespace
k create clusterrole secret-reader --verb=get,list --resource=secrets
k create rolebinding ci-secret-reader -n web --clusterrole=secret-reader --serviceaccount=web:ci
k create rolebinding ci-secret-reader -n default --clusterrole=secret-reader --serviceaccount=web:ci

# 4. PersistentVolumes have no namespace, so only a ClusterRoleBinding reaches them
k create clusterrole pv-lister --verb=list --resource=persistentvolumes
k create clusterrolebinding ci-pv-lister --clusterrole=pv-lister --serviceaccount=web:ci

# 5.
k create rolebinding auditors-view -n web --clusterrole=view --group=auditors

# check: the first answer of each pair is yes, the second is no
SA=system:serviceaccount:web:ci
k auth can-i delete deployments.apps -n web --as=$SA
k auth can-i get deployments.apps -n web --as=$SA
k auth can-i list secrets -n default --as=$SA
k auth can-i list secrets -n kube-system --as=$SA
k auth can-i list persistentvolumes --as=$SA
k auth can-i delete persistentvolumes --as=$SA
k auth can-i list pods -n web --as=anyone --as-group=auditors
k auth can-i list pods -n default --as=anyone --as-group=auditors
```
</details>

## Next

* [rbac](../../references/rbac.md) has the object model, the subject kinds, the roles every
  subject gets, and the failure modes in one place.
* [Using RBAC Authorization](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)
  is the reference for every field of a Role, a ClusterRole and both bindings.
* [ServiceAccounts](https://kubernetes.io/docs/concepts/security/service-accounts/) covers
  how the subject you created authenticates, and how a pod gets one.
* [Authorization](https://kubernetes.io/docs/reference/access-authn-authz/authorization/)
  explains where RBAC sits among the other authorizers a request passes through.
