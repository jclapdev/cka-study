#!/usr/bin/env bash
# Grades the exam workflow drill's Practice it on the running lab. Run on the Mac.
source "$(dirname "$0")/../../lab/grade-lib.sh"
grade <<'CHECKS'
j() { k get "$@" -o jsonpath="$JP" 2>/dev/null; }

task 1 15
check 1 "namespace shop exists" k get ns shop
check 1 "Deployment api runs nginx" bash -c 'k get deploy api -n shop -o jsonpath="{.spec.template.spec.containers[0].image}" | grep -q "^nginx:"'

task 2 15
check 1 "Service api is ClusterIP on port 80" test "$(k get svc api -n shop -o jsonpath='{.spec.type} {.spec.ports[0].port} {.spec.ports[0].targetPort}')" = "ClusterIP 80 80"
check 1 "Service api has endpoints" bash -c '[ -n "$(k get endpointslices -n shop -l kubernetes.io/service-name=api -o jsonpath="{.items[*].endpoints[*].addresses[*]}")" ]'

task 3 20
check 1 "ConfigMap api-config has MODE=fast" test "$(k get cm api-config -n shop -o jsonpath='{.data.MODE}')" = fast
check 1 "Secret api-secret has TOKEN=abc123" test "$(k get secret api-secret -n shop -o jsonpath='{.data.TOKEN}' | base64 -d)" = abc123

task 4 20
check 1 "NetworkPolicy deny-in exists" k get netpol deny-in -n shop
check 1 "it selects every pod" test "$(k get netpol deny-in -n shop -o jsonpath='{.spec.podSelector}')" = "{}"
check 1 "it denies all ingress" bash -c '[ "$(k get netpol deny-in -n shop -o jsonpath="{.spec.policyTypes}")" = "[\"Ingress\"]" ] && [ -z "$(k get netpol deny-in -n shop -o jsonpath="{.spec.ingress}")" ]'

task 5 15
check 1 "node01:/opt/course/5/runtime.txt names containerd's version" ssh node01 'grep -q "containerd.* $(containerd --version | awk "{print \$3}")" /opt/course/5/runtime.txt'

task 6 15
check 1 "api runs nginx:1.28" test "$(k get deploy api -n shop -o jsonpath='{.spec.template.spec.containers[0].image}')" = nginx:1.28
check 1 "api has 3 ready replicas" test "$(k get deploy api -n shop -o jsonpath='{.status.readyReplicas}')" = 3
CHECKS
