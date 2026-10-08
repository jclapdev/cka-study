# Certificates

A certificate is a small file that ties a name to a public key and is signed by someone both sides trust. A CA (certificate authority) is that trusted signer: a key pair whose own certificate everyone holds, so anyone can check that a certificate it signed is genuine. X509 is the standard format for these certificates, the same one HTTPS uses. Kubernetes uses x509 certificates throughout, so `openssl x509` reads them ([PKI certificates and requirements](https://kubernetes.io/docs/setup/best-practices/certificates/)).

The cluster's components use certificates for two things: to prove who they are, and to encrypt the connection. A component holds a certificate (`.crt`) and its private key (`.key`). The key never leaves the machine.

## Client and serving certificates

TLS (Transport Layer Security) is the protocol that sets up an encrypted, authenticated connection using these certificates, the same one behind HTTPS. Each connection has two sides:

- A **serving certificate** proves the server's identity to the client. The [apiserver](control-plane.md#components)'s lists every name and IP a client may use to reach it, so a client connecting to an address not on the list fails the check ([server certificates](https://kubernetes.io/docs/setup/best-practices/certificates/#server-certificates)).
- A **client certificate** proves the client's identity to the server. The apiserver reads the user name from its `CN` (common name) and the groups from its `O` (organisation) fields ([authentication](authentication.md#client-certificates)).

## On a kubeadm cluster

`kubeadm init` creates a CA and signs every other certificate with it. PKI (public key infrastructure) is the set of keys, certificates and CAs that a system's trust is built on. The cluster's PKI is these files, kept in `/etc/kubernetes/pki/` on the [control plane](control-plane.md) node ([where certificates are stored](https://kubernetes.io/docs/setup/best-practices/certificates/#where-certificates-are-stored)):

| File | What it is |
| --- | --- |
| `ca.crt`, `ca.key` | The cluster CA. `ca.crt` is also copied into every [kubeconfig](kubeconfig.md) and every pod, so clients can check the apiserver. |
| `apiserver.crt` | The apiserver's serving certificate. |
| `apiserver-kubelet-client.crt` | The apiserver's client certificate for calling kubelets. |
| `etcd/ca.crt` and the rest of `etcd/` | A separate CA for etcd, and etcd's own certificates. |
| `front-proxy-ca.crt` | A CA for API extensions. |
| `sa.key`, `sa.pub` | A key pair, not a certificate, that signs [ServiceAccount](service-accounts.md) tokens. |

The kubeconfigs in `/etc/kubernetes/` (`admin.conf`, `controller-manager.conf`, `scheduler.conf`) carry client certificates signed by the same CA ([kubeconfig](kubeconfig.md#on-a-kubeadm-cluster)). [kubeadm](kubeadm.md) signs them for one year and the CA for ten ([certificate expiry](https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-certs/#check-certificate-expiration)).

## Certificate signing requests

A CSR (certificate signing request) is a request for a CA to sign a new certificate. In Kubernetes it is also an object, `CertificateSigningRequest`, that someone approves before the controller-manager signs it ([certificate signing requests](https://kubernetes.io/docs/reference/access-authn-authz/certificate-signing-requests/)). A worker gets its kubelet's client certificate this way when it [joins](workers.md#joining), and that request is approved automatically. `kubectl get csr` lists the requests. The cluster deletes approved requests after an hour, so on a cluster older than that it prints `No resources found`.

## Example

The apiserver's serving certificate, signed by the cluster CA (`CN = kubernetes`), with the names a client may use:

```
subject=CN = kube-apiserver
issuer=CN = kubernetes
notBefore=Sep 30 01:22:26 2026 GMT
notAfter=Sep 30 01:27:26 2027 GMT
X509v3 Subject Alternative Name:
    DNS:controlplane, DNS:kubernetes, DNS:kubernetes.default, DNS:kubernetes.default.svc, DNS:kubernetes.default.svc.cluster.local, IP Address:10.96.0.1, IP Address:192.0.2.10
```

`10.96.0.1` is the `kubernetes` [Service](services.md), which is how pods reach the apiserver.

`sudo kubeadm certs check-expiration`, trimmed:

```
CERTIFICATE                EXPIRES                  RESIDUAL TIME   CERTIFICATE AUTHORITY   EXTERNALLY MANAGED
admin.conf                 Sep 30, 2027 01:27 UTC   359d            ca                      no
apiserver                  Sep 30, 2027 01:27 UTC   359d            ca                      no
apiserver-etcd-client      Sep 30, 2027 01:27 UTC   359d            etcd-ca                 no

CERTIFICATE AUTHORITY   EXPIRES                  RESIDUAL TIME   EXTERNALLY MANAGED
ca                      Sep 27, 2036 01:27 UTC   9y              no
etcd-ca                 Sep 27, 2036 01:27 UTC   9y              no
front-proxy-ca          Sep 27, 2036 01:27 UTC   9y              no
```

## Commands

```bash
sudo ls /etc/kubernetes/pki
sudo openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -subject -issuer -dates -ext subjectAltName
sudo kubeadm certs check-expiration
sudo kubeadm certs renew all        # then restart the control plane static pods
kubectl get csr
kubectl certificate approve <name>
```

## Failure modes

| Symptom | Cause |
| --- | --- |
| `Unable to connect to the server: tls: failed to verify certificate: x509: certificate signed by unknown authority` | The client's CA doesn't match the CA that signed the server's certificate, such as a kubeconfig left from an earlier cluster. |
| `x509: certificate is valid for 10.96.0.1, 192.0.2.10, not 127.0.0.1` | The client used an address that isn't in the serving certificate ([the advertise address](kubeadm.md#the-advertise-address)). |

## Docs

- [PKI certificates and requirements](https://kubernetes.io/docs/setup/best-practices/certificates/)
- [Certificate management with kubeadm](https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-certs/)
- [Certificates and certificate signing requests](https://kubernetes.io/docs/reference/access-authn-authz/certificate-signing-requests/)
