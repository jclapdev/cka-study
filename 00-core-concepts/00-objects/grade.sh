#!/usr/bin/env bash
# Grades the Kubernetes Objects Practice on the running lab. Run on a machine with docker, such as the app container.
source "$(dirname "$0")/../../lab/grade-lib.sh"
grade <<'CHECKS'
jp() { k get "$1" "$2" -n store -o jsonpath="$3"; }

task 1 15
check 1 "namespace store exists" k get ns store
check 2 "pod front runs nginx:1.27" test "$(jp pod front '{.spec.containers[0].image}')" = nginx:1.27

task 2 25
check 1 "ReplicaSet cache exists" k get rs cache -n store
check 1 "it keeps 2 replicas" test "$(jp rs cache '{.spec.replicas}')" = 2
check 1 "it runs nginx:1.27" test "$(jp rs cache '{.spec.template.spec.containers[0].image}')" = nginx:1.27
check 1 "its pods are labelled app=cache" test "$(jp rs cache '{.spec.template.metadata.labels.app}')" = cache

task 3 20
check 1 "Deployment api runs nginx:1.27" test "$(jp deploy api '{.spec.template.spec.containers[0].image}')" = nginx:1.27
check 1 "it has ready pods" bash -c '[ "$(k get deploy api -n store -o jsonpath="{.status.readyReplicas}")" -ge 3 ]'

task 4 20
check 1 "Service api listens on port 80" test "$(jp svc api '{.spec.ports[0].port}')" = 80
check 2 "it sends traffic to api's pods" bash -c '[ -n "$(k get endpointslices -n store -l kubernetes.io/service-name=api -o jsonpath="{.items[*].endpoints[*].addresses[0]}")" ]'

task 5 20
check 1 "~/api.yaml is Deployment api with 4 replicas" bash -c 'grep -q "kind: Deployment" ~/api.yaml && grep -q "name: api" ~/api.yaml && grep -q "replicas: 4" ~/api.yaml'
check 1 "api has 4 replicas" test "$(jp deploy api '{.spec.replicas}')" = 4
check 1 "it was applied with kubectl apply" bash -c 'k get deploy api -n store -o yaml | grep -q last-applied-configuration'
CHECKS
