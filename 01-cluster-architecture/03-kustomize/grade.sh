#!/usr/bin/env bash
# Grades the Kustomize Practice it on the running lab. Run on the Mac.
source "$(dirname "$0")/../../lab/grade-lib.sh"
grade <<'CHECKS'
jp() { k get "$1" "$2" -n "$3" -o jsonpath="$4"; }

task 1 25
check 1 "~/shop/base builds" k kustomize ~/shop/base
check 1 "it holds Deployment shop running nginx:1.27" bash -c 'k kustomize ~/shop/base | grep -q "image: nginx:1.27"'
check 1 "it holds a Service shop on port 80" bash -c 'k kustomize ~/shop/base | grep -A12 "kind: Service" | grep -q "port: 80"'

task 2 30
check 1 "namespace staging exists" k get ns staging
check 2 "Deployment staging-shop runs nginx:1.28" test "$(jp deploy staging-shop staging '{.spec.template.spec.containers[0].image}')" = nginx:1.28
check 2 "it has 2 replicas" test "$(jp deploy staging-shop staging '{.spec.replicas}')" = 2
check 1 "Service staging-shop exists" k get svc staging-shop -n staging

task 3 25
check 1 "tools-api was applied with the base in /opt/course/3 unchanged" bash -c 'k get deploy tools-api -n tools && cd /opt/course/3/base && echo "20bf2295d09d74b9a1811d066260d5d8  deployment.yaml
f61b86910cf94d4ff7a8c8de74576284  kustomization.yaml" | md5sum -c --quiet'
check 2 "Deployment tools-api in tools has 2 replicas" test "$(jp deploy tools-api tools '{.spec.replicas}')" = 2

task 4 20
check 1 "a ConfigMap staging-shop-settings-<hash> has MODE=staging" bash -c 'k get cm -n staging -o jsonpath="{range .items[*]}{.metadata.name} {.data.MODE}{\"\n\"}{end}" | grep -qE "^staging-shop-settings-[a-z0-9]+ staging$"'
check 2 "the shop container reads it as environment variables" test "$(k exec -n staging deploy/staging-shop -- printenv MODE)" = staging
CHECKS
