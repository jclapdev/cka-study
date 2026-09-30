#!/usr/bin/env bash
# Grades the CRDs and operators Practice it on the running lab. Run on a machine with docker, such as the app container.
source "$(dirname "$0")/../../lab/grade-lib.sh"
grade <<'CHECKS'
task 1 15
check 1 "release cert-manager in cert-manager is chart v1.21.2" bash -c 'helm list -n cert-manager -o json | yq -p json -e ".[] | select(.name == \"cert-manager\" and .chart == \"cert-manager-v1.21.2\")"'
check 1 "its CRDs are installed" k get crd certificates.cert-manager.io issuers.cert-manager.io
check 1 "its three Deployments are available" bash -c '[ "$(k get deploy -n cert-manager -o jsonpath="{range .items[*]}{.status.availableReplicas}{end}")" = 111 ]'

task 2 15
check 1 "/opt/course/2/crds.txt names every cert-manager CRD" bash -c 'n=$(k get crd -o name | grep -c cert-manager); [ "$n" -gt 0 ] && for c in $(k get crd -o jsonpath="{.items[*].metadata.name}" | tr " " "\n" | grep cert-manager); do grep -q "$c" /opt/course/2/crds.txt || exit 1; done'
check 1 "and no other CRD" bash -c '[ -s /opt/course/2/crds.txt ] && ! grep -v cert-manager /opt/course/2/crds.txt | grep -q "\."'

task 3 15
check 1 "/opt/course/3/subject.txt is the explain output for Certificate spec.subject" bash -c 'grep -q "FIELD: subject" /opt/course/3/subject.txt && grep -q "KIND:       Certificate" /opt/course/3/subject.txt'

task 4 30
check 1 "Issuer self in web is Ready" test "$(k get issuer self -n web -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')" = True
check 1 "it is self-signed" bash -c 'k get issuer self -n web -o yaml | grep -q "selfSigned:"'
check 2 "Certificate web-cert is Ready and stored in web-tls" test "$(k get certificate web-cert -n web -o jsonpath='{.spec.secretName} {.status.conditions[?(@.type=="Ready")].status}')" = "web-tls True"
check 1 "the certificate is for web.example.com" bash -c 'k get secret web-tls -n web -o jsonpath="{.data.tls\.crt}" | base64 -d | openssl x509 -noout -ext subjectAltName | grep -q "DNS:web.example.com"'

task 5 25
check 1 "CRD backups.stable.example.com exists" k get crd backups.stable.example.com
check 1 "its kind is Backup, namespaced, short name bk" test "$(k get crd backups.stable.example.com -o jsonpath='{.spec.names.kind} {.spec.scope} {.spec.names.shortNames[0]}')" = "Backup Namespaced bk"
check 1 "schedule is a string and retentionDays an integer" test "$(k get crd backups.stable.example.com -o jsonpath='{.spec.versions[0].schema.openAPIV3Schema.properties.spec.properties.schedule.type} {.spec.versions[0].schema.openAPIV3Schema.properties.spec.properties.retentionDays.type}')" = "string integer"
check 2 "Backup nightly in default has the schedule and 7 days" test "$(k get bk nightly -n default -o jsonpath='{.spec.schedule} {.spec.retentionDays}')" = "0 2 * * * 7"
CHECKS
