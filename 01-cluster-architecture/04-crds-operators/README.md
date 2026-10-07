# CRDs and Operators

A [CustomResourceDefinition](../../references/crds.md) (CRD) adds a new resource type to the [apiserver](../../references/control-plane.md#components), and an [operator](../../references/crds.md#operators) is a
controller that watches objects of that type and does the work they describe. Installing an
operator usually means installing its CRDs and its controller together, often from a [Helm](../../references/helm.md) [chart](../../references/helm.md#charts-repositories-and-releases).
[How CRDs and operators extend Kubernetes](../../learn/crds-operators.md) explains the model.

Starts from the [`crds` lab](../../lab/labs/crds/README.md). Every command runs on `controlplane`, reached with `ssh controlplane` from `base`.

## Objectives

* Find the CRDs a cluster has, and the resource types they add.
* Create a CRD from the docs' example, and objects of the new type.
* See the schema reject a wrong value and an unknown field.
* Install an operator, cert-manager, with Helm, and list the CRDs it brought.
* Build a custom resource with `k explain`, and watch the operator act on it.
* Save a CRD list and a field's documentation to files.

## Look for custom resources

A [CRD](../../references/crds.md#what-a-crd-adds) is itself an object, of the cluster-scoped type `customresourcedefinitions`.

1. List the CRDs, and the type that holds them:

   ```shell
   k get crd
   k api-resources --api-group=apiextensions.k8s.io
   ```

   The output is similar to this:

   ```
   No resources found
   NAME                        SHORTNAMES   APIVERSION                NAMESPACED   KIND
   customresourcedefinitions   crd,crds     apiextensions.k8s.io/v1   false        CustomResourceDefinition
   ```

   A new [kubeadm](../../references/kubeadm.md) cluster with [Flannel](../../references/pod-network.md#plugins) has none. Every type so far is built into the apiserver.

## Create a CRD

1. Search kubernetes.io for `customresourcedefinition`, open
   [Extend the Kubernetes API with CustomResourceDefinitions](https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definitions/#create-a-customresourcedefinition),
   and copy the `CronTab` CustomResourceDefinition under "Create a CustomResourceDefinition".
   Paste it into `vim resourcedefinition.yaml` with `:set paste`, and save. It defines the
   group `stable.example.com`, the kind `CronTab`, the short name `ct`, and three fields under
   `spec`: `cronSpec` and `image` as strings, `replicas` as an integer.

2. Apply it and look for the new type:

   ```shell
   k apply -f resourcedefinition.yaml
   k get crd
   k api-resources --api-group=stable.example.com
   ```

   The output is similar to this:

   ```
   NAME                          CREATED AT
   crontabs.stable.example.com   2026-09-28T00:16:22Z
   NAME       SHORTNAMES   APIVERSION              NAMESPACED   KIND
   crontabs   ct           stable.example.com/v1   true         CronTab
   ```

   The CRD's name is `<plural>.<group>`. The new type is namespaced because the CRD says
   [`scope: Namespaced`](../../references/crds.md#the-parts-of-a-crd).

3. Read the new type's fields:

   ```shell
   k explain crontab.spec
   ```

   The output is similar to this:

   ```
   GROUP:      stable.example.com
   KIND:       CronTab
   VERSION:    v1

   FIELD: spec <Object>


   DESCRIPTION:
       <empty>
   FIELDS:
     cronSpec	<string>
       <no description>

     image	<string>
       <no description>

     replicas	<integer>
       <no description>
   ```

   `k explain` reads the CRD's schema. Run straight after `k apply`, it can fail with
   `couldn't find resource`, until the CRD is [`Established`](../../references/crds.md#failure-modes).

## Create custom objects

1. On the same page, copy the `CronTab` object under
   [Create custom objects](https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definitions/#create-custom-objects)
   into `vim my-crontab.yaml`, then apply it and list it by both names:

   ```shell
   k apply -f my-crontab.yaml
   k get crontab
   k get ct
   ```

   Both commands list `my-new-cron-object`, because `ct` is the short name the CRD defines.

2. Try an object whose `replicas` is text. Copy `my-crontab.yaml` to `bad.yaml`, and in vim
   change the name to `bad` and the `spec` to:

   ```yaml
   spec:
     replicas: three
   ```

   ```shell
   k apply -f bad.yaml
   ```

   The output is similar to this:

   ```
   The CronTab "bad" is invalid: spec.replicas: Invalid value: "string": spec.replicas in body must be of type integer: "string"
   ```

   The apiserver checks every object against the CRD's [`openAPIV3Schema`](../../references/crds.md#schemas-and-validation).

3. Try a field the schema does not have. In `bad.yaml`, change the name to `extra` and the
   `spec` to:

   ```yaml
   spec:
     image: x
     colour: blue
   ```

   ```shell
   k apply -f bad.yaml
   ```

   The output is similar to this:

   ```
   Error from server (BadRequest): error when creating "bad.yaml": CronTab in version "v1" cannot be handled as a CronTab: strict decoding error: unknown field "spec.colour"
   ```

4. Delete the CRD, then list the objects again:

   ```shell
   k delete crd crontabs.stable.example.com
   k get ct
   ```

   The output is similar to this:

   ```
   customresourcedefinition.apiextensions.k8s.io "crontabs.stable.example.com" deleted
   Error from server (NotFound): Unable to list "stable.example.com/v1, Resource=crontabs": the server could not find the requested resource (get crontabs.stable.example.com)
   ```

   Deleting a CRD deletes every object of its type, in every namespace:
   [delete a CustomResourceDefinition](https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definitions/#delete-a-customresourcedefinition).

## Install an operator

An [operator](../../references/crds.md#operators) is a controller for custom resources. cert-manager issues [TLS](../../references/certificates.md#client-and-serving-certificates) [certificates](../../references/certificates.md): you
create a `Certificate` object, and its controller writes the key and certificate into a [Secret](../../references/config.md#secrets).

1. Install cert-manager's Helm chart, with its CRDs. A task gives the chart and version, or
   links the operator's install page in its [Quick Reference](../../references/kubectl.md#snippets-from-the-docs) box:

   ```shell
   helm install cert-manager oci://quay.io/jetstack/charts/cert-manager --version v1.21.2 -n cert-manager --create-namespace --set crds.enabled=true
   ```

   The output starts like this:

   ```
   Pulled: quay.io/jetstack/charts/cert-manager:v1.21.2
   Digest: sha256:634dce9c13b56677a2c05e2ab76c312d0be2664022d5dd05815da67e1fd5f610
   NAME: cert-manager
   LAST DEPLOYED: Sun Sep 27 20:16:49 2026
   NAMESPACE: cert-manager
   STATUS: deployed
   REVISION: 1
   DESCRIPTION: Install complete
   ```

   `crds.enabled=true` makes the chart install the CRDs as normal objects. Without it, this
   chart installs [no CRDs](../../references/crds.md#crds-from-helm-charts).

2. Wait for the controller, then list what the chart added:

   ```shell
   k wait --for=condition=Available deploy --all -n cert-manager --timeout=180s
   k get pods -n cert-manager
   k get crd | grep cert-manager
   ```

   The output is similar to this:

   ```
   NAME                                       READY   STATUS    RESTARTS   AGE
   cert-manager-bc44b5799-rv2r8               1/1     Running   0          15s
   cert-manager-cainjector-784846b495-pbwzx   1/1     Running   0          15s
   cert-manager-webhook-6c6d98f866-rggr2      1/1     Running   0          15s
   certificaterequests.cert-manager.io   2026-09-28T00:16:50Z
   certificates.cert-manager.io          2026-09-28T00:16:50Z
   challenges.acme.cert-manager.io       2026-09-28T00:16:50Z
   clusterissuers.cert-manager.io        2026-09-28T00:16:50Z
   issuers.cert-manager.io               2026-09-28T00:16:50Z
   orders.acme.cert-manager.io           2026-09-28T00:16:50Z
   ```

3. List the new types in the `cert-manager.io` group:

   ```shell
   k api-resources --api-group=cert-manager.io
   ```

   The output is similar to this:

   ```
   NAME                  SHORTNAMES   APIVERSION           NAMESPACED   KIND
   certificaterequests   cr,crs       cert-manager.io/v1   true         CertificateRequest
   certificates          cert,certs   cert-manager.io/v1   true         Certificate
   clusterissuers        ciss         cert-manager.io/v1   false        ClusterIssuer
   issuers               iss          cert-manager.io/v1   true         Issuer
   ```

   An Issuer is namespaced and a ClusterIssuer is not, the same [split](../../references/namespaces.md#namespaced-and-cluster-scoped-resources) as a [Role](../../references/rbac.md#the-model) and a
   ClusterRole.

## Configure the operator

No `kubectl create` command and no kubernetes.io page writes a cert-manager object. `k explain`
reads the fields from the CRD's schema, and marks the [required ones](../../references/kubectl.md#kubectl-explain).

1. Find what an Issuer can be, and what a [Certificate](../../references/crds.md#operators) needs:

   ```shell
   k explain issuer.spec | grep -E '^  [a-zA-Z]'
   k explain certificate.spec | grep -- '-required-'
   ```

   The output is similar to this:

   ```
     acme	<Object>
     ca	<Object>
     selfSigned	<Object>
     vault	<Object>
     venafi	<Object>
     issuerRef	<Object> -required-
     secretName	<string> -required-
   ```

2. Create a namespace, then write the smallest Issuer that works, a self-signed one, in
   `vim issuer.yaml`:

   ```yaml
   apiVersion: cert-manager.io/v1
   kind: Issuer
   metadata:
     name: selfsigned
     namespace: demo
   spec:
     selfSigned: {}
   ```

   ```shell
   k create ns demo
   k apply -f issuer.yaml
   k get issuer -n demo
   ```

   The output is similar to this:

   ```
   NAME         READY   AGE
   selfsigned   True    0s
   ```

   `apiVersion` and `kind` come from `k api-resources`. `READY True` is the operator's report,
   written into the object's `status`.

3. Write a Certificate with the two required fields and a DNS name, in `vim cert.yaml`:

   ```yaml
   apiVersion: cert-manager.io/v1
   kind: Certificate
   metadata:
     name: demo
     namespace: demo
   spec:
     secretName: demo-tls
     dnsNames:
     - demo.example.com
     issuerRef:
       name: selfsigned
   ```

   ```shell
   k apply -f cert.yaml
   k get certificate,certificaterequest -n demo
   k get secret demo-tls -n demo
   ```

   The output is similar to this:

   ```
   NAME                               READY   SECRET     AGE
   certificate.cert-manager.io/demo   True    demo-tls   5s

   NAME                                        APPROVED   DENIED   READY   ISSUER       REQUESTER                                         AGE
   certificaterequest.cert-manager.io/demo-1   True                True    selfsigned   system:serviceaccount:cert-manager:cert-manager   5s
   NAME       TYPE                DATA   AGE
   demo-tls   kubernetes.io/tls   3      5s
   ```

   You created one object. The controller created the CertificateRequest and the Secret, as
   its [ServiceAccount](../../references/service-accounts.md).

4. Read the certificate the Secret holds:

   ```shell
   k get secret demo-tls -n demo -o jsonpath='{.data.tls\.crt}' | base64 -d | openssl x509 -noout -ext subjectAltName -enddate
   ```

   The output is similar to this:

   ```
   X509v3 Subject Alternative Name: critical
       DNS:demo.example.com
   notAfter=Dec 27 00:20:37 2026 GMT
   ```

5. Delete the Secret, and look again a few seconds later:

   ```shell
   k delete secret demo-tls -n demo
   k get secret demo-tls -n demo
   ```

   The output is similar to this:

   ```
   NAME       TYPE                DATA   AGE
   demo-tls   kubernetes.io/tls   3      5s
   ```

   The controller saw the Certificate's Secret missing and issued a new one. Changing what an
   operator manages means changing its custom resource, not the objects it creates.

6. Leave out a required field. In `vim cert.yaml`, change the name to `nope` and delete the
   `secretName` line, then apply it:

   ```shell
   k apply -f cert.yaml
   ```

   The output is similar to this:

   ```
   The Certificate "nope" is invalid: spec.secretName: Required value
   ```

## Save answers to files

Tasks often ask for a list or a piece of documentation in a file. Only the file is graded.

1. Write the names of cert-manager's CRDs to a file:

   ```shell
   k get crd -o name | grep cert-manager > crds.txt
   cat crds.txt
   ```

   The output is similar to this:

   ```
   customresourcedefinition.apiextensions.k8s.io/certificaterequests.cert-manager.io
   customresourcedefinition.apiextensions.k8s.io/certificates.cert-manager.io
   customresourcedefinition.apiextensions.k8s.io/challenges.acme.cert-manager.io
   customresourcedefinition.apiextensions.k8s.io/clusterissuers.cert-manager.io
   customresourcedefinition.apiextensions.k8s.io/issuers.cert-manager.io
   customresourcedefinition.apiextensions.k8s.io/orders.acme.cert-manager.io
   ```

2. Write the documentation of one field to a file:

   ```shell
   k explain certificate.spec.subject > subject.txt
   head -9 subject.txt
   ```

   The output is similar to this:

   ```
   GROUP:      cert-manager.io
   KIND:       Certificate
   VERSION:    v1

   FIELD: subject <Object>


   DESCRIPTION:
       Requested set of X509 certificate subject attributes.
   ```

## Quiz

<details><summary>What does creating a CRD add to the cluster, and what does it not add?</summary>

A new resource type the apiserver stores and validates, at `/apis/<group>/<version>/<plural>`.
It adds no behaviour: nothing acts on the objects until a controller watches them.
</details>

<details><summary>What is the name of a CRD for the kind `Backup`, plural `backups`, in the group `stable.example.com`?</summary>

`backups.stable.example.com`, which is `<plural>.<group>`.
</details>

<details><summary>Where is a CRD example you can copy from the allowed docs?</summary>

Search kubernetes.io for `customresourcedefinition` and open "Extend the Kubernetes API with
CustomResourceDefinitions". The `CronTab` example is under "Create a CustomResourceDefinition".
</details>

<details><summary>How do you find the fields and the required fields of a custom resource you have never seen?</summary>

`k api-resources --api-group=<group>` for its kind and `apiVersion`, then `k explain <kind>.spec`,
where required fields end in `-required-`.
</details>

<details><summary>What happens to custom objects when their CRD is deleted?</summary>

They are all deleted, in every namespace.
</details>

<details><summary>You delete the Secret an operator created. What happens, and why?</summary>

The operator creates it again, because its custom resource still asks for it. To change the
result, change the custom resource.
</details>

## Practice

Do it again without the steps. Give yourself **18 minutes**.

Start from a fresh [`crds` lab](../../lab/labs/crds/README.md). When time is up,
[grade the run](../../lab/README.md#grading).

1. **Host `controlplane`, weight 15%.** Install cert-manager with Helm from the chart
   `oci://quay.io/jetstack/charts/cert-manager`, version `v1.21.2`, as the release
   `cert-manager` in the namespace `cert-manager`, including its CRDs (value `crds.enabled=true`).
2. **Host `controlplane`, weight 15%.** Write the names of all CRDs that cert-manager installed,
   and no others, to `/opt/course/2/crds.txt`.
3. **Host `controlplane`, weight 15%.** Using `kubectl`, write the documentation of the `subject`
   field of a cert-manager `Certificate`'s `spec` to `/opt/course/3/subject.txt`.
4. **Host `controlplane`, weight 30%.** In a new namespace `web`, create a self-signed Issuer
   `self`, and a Certificate `web-cert` for the DNS name `web.example.com`, stored in the Secret
   `web-tls`. The Certificate must be Ready.
5. **Host `controlplane`, weight 25%.** Create a CRD for a namespaced kind `Backup` in the group
   `stable.example.com`, version `v1`, plural `backups`, short name `bk`, with two `spec`
   fields: `schedule`, a string, and `retentionDays`, an integer. Then create a `Backup` named
   `nightly` in `default` with `schedule` `0 2 * * *` and `retentionDays` 7.

<details><summary>Solution</summary>

Tasks 1 to 3:

```shell
ssh controlplane
helm install cert-manager oci://quay.io/jetstack/charts/cert-manager --version v1.21.2 -n cert-manager --create-namespace --set crds.enabled=true
k get crd -o name | grep cert-manager > /opt/course/2/crds.txt
k explain certificate.spec.subject > /opt/course/3/subject.txt
```

Task 4. Wait for cert-manager, then write both objects in `vim web.yaml`:

```shell
k wait --for=condition=Available deploy --all -n cert-manager --timeout=180s
k create ns web
vim web.yaml
```

```yaml
apiVersion: cert-manager.io/v1
kind: Issuer
metadata:
  name: self
  namespace: web
spec:
  selfSigned: {}
---
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: web-cert
  namespace: web
spec:
  secretName: web-tls
  dnsNames:
  - web.example.com
  issuerRef:
    name: self
```

```shell
k apply -f web.yaml
```

Task 5. Paste the docs' `CronTab` CRD into `vim backup-crd.yaml`, and change the name, the two
fields and the names:

```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: backups.stable.example.com
spec:
  group: stable.example.com
  versions:
    - name: v1
      served: true
      storage: true
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              properties:
                schedule:
                  type: string
                retentionDays:
                  type: integer
  scope: Namespaced
  names:
    plural: backups
    singular: backup
    kind: Backup
    shortNames:
    - bk
```

Paste the docs' `CronTab` object into `vim nightly.yaml` the same way:

```yaml
apiVersion: stable.example.com/v1
kind: Backup
metadata:
  name: nightly
spec:
  schedule: "0 2 * * *"
  retentionDays: 7
```

```shell
k apply -f backup-crd.yaml
k apply -f nightly.yaml
```

</details>

## Check your work

Grade the run, or check by hand on `controlplane`:

1. The Certificate is Ready:

   ```shell
   k get certificate -n web
   ```

   ```
   NAME       READY   SECRET    AGE
   web-cert   True    web-tls   10s
   ```

2. The file lists the six CRDs:

   ```shell
   wc -l < /opt/course/2/crds.txt
   ```

   ```
   6
   ```

## Next

* [crds](../../references/crds.md) has the parts of a CRD, validation, operators and the failure
  modes in one place.
* [Custom Resources](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/)
  explains when to add a custom resource, and the other way to extend the API, aggregation, which
  puts a separate API server behind the main one.
* [Operator pattern](https://kubernetes.io/docs/concepts/extend-kubernetes/operator/) describes
  what operators automate and how they are deployed.
