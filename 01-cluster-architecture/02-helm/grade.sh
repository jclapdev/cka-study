#!/usr/bin/env bash
# Grades the Helm Practice it on the running lab. Run on the Mac.
source "$(dirname "$0")/../../lab/grade-lib.sh"
grade <<'CHECKS'

task 1 20
check 1 "repository podinfo points at the podinfo chart repo" bash -c 'helm repo list -o json | yq -p json -e ".[] | select(.name == \"podinfo\" and .url == \"https://stefanprodan.github.io/podinfo\")"'
check 2 "revision 1 of shop in store is podinfo-6.14.1" bash -c 'helm history shop -n store -o json | yq -p json -e ".[0].chart == \"podinfo-6.14.1\""'
check 1 "it was installed with 3 replicas" test "$(helm get values shop -n store --revision 1 -o json | yq -p json '.replicaCount')" = 3

task 2 25
check 2 "a revision of shop runs podinfo-6.15.0" bash -c 'helm history shop -n store -o json | yq -p json -e "[.[] | select(.chart == \"podinfo-6.15.0\")] | length > 0"'
check 1 "that revision sets ui.message=sale" bash -c 'r=$(helm history shop -n store -o json | yq -p json "[.[] | select(.chart == \"podinfo-6.15.0\")][0].revision"); [ "$(helm get values shop -n store --revision "$r" -o json | yq -p json ".ui.message")" = sale ]'
check 1 "and keeps 3 replicas" bash -c 'r=$(helm history shop -n store -o json | yq -p json "[.[] | select(.chart == \"podinfo-6.15.0\")][0].revision"); [ "$(helm get values shop -n store --revision "$r" -o json | yq -p json ".replicaCount")" = 3 ]'

task 3 20
check 2 "the deployed revision is a rollback to podinfo-6.14.1" bash -c 'helm history shop -n store -o json | yq -p json -e ".[-1] | (.status == \"deployed\" and .chart == \"podinfo-6.14.1\" and .rollback_revision == 1)"'
check 1 "the Deployment runs 6.14.1 with 3 replicas" test "$(k get deploy shop-podinfo -n store -o jsonpath='{.spec.replicas} {.spec.template.spec.containers[0].image}')" = "3 ghcr.io/stefanprodan/podinfo:6.14.1"

task 4 20
check 1 "~/preview.yaml has the preview Deployment at 6.15.0" bash -c 'grep -q "name: preview-podinfo" ~/preview.yaml && grep -q "image: \"*ghcr.io/stefanprodan/podinfo:6.15.0" ~/preview.yaml'
check 1 "it has no test pods" bash -c '[ -s ~/preview.yaml ] && ! grep -q "^kind: Pod" ~/preview.yaml'
check 1 "preview was not installed" bash -c '[ -s ~/preview.yaml ] && ! helm status preview -n store'

task 5 15
check 2 "release legacy is uninstalled" bash -c '! helm status legacy -n legacy'
check 1 "namespace legacy remains after the uninstall" bash -c '! helm status legacy -n legacy && k get ns legacy'
CHECKS
