#!/usr/bin/env bash
# Grades the RBAC Practice it on the running lab. Run on a machine with docker, such as the app container.
source "$(dirname "$0")/../../lab/grade-lib.sh"
grade <<'CHECKS'
SA=system:serviceaccount:web:ci
can() { [ "$(k auth can-i "$@")" = yes ]; }
cannot() { [ "$(k auth can-i "$@")" = no ]; }
export -f can cannot; export SA

task 1 15
check 1 "namespace web exists" k get ns web
check 1 "ServiceAccount ci exists in web" k get sa ci -n web

task 2 25
check 1 "Role deployer and RoleBinding ci-deployer exist" bash -c 'k get role deployer -n web && k get rolebinding ci-deployer -n web'
check 2 "ci can create, update and delete Deployments in web" bash -c 'for v in create update delete; do can $v deployments.apps -n web --as=$SA || exit 1; done'
check 1 "and nothing more on them" bash -c 'k get role deployer -n web && cannot get deployments.apps -n web --as=$SA && cannot list deployments.apps -n web --as=$SA'

task 3 20
check 1 "ClusterRole secret-reader exists" k get clusterrole secret-reader
check 2 "ci can read Secrets in web and default" bash -c 'for n in web default; do can get secrets -n $n --as=$SA && can list secrets -n $n --as=$SA || exit 1; done'
check 1 "but not in kube-system" bash -c 'k get rolebinding ci-secret-reader -n web && cannot list secrets -n kube-system --as=$SA'

task 4 20
check 1 "ClusterRoleBinding ci-pv-lister uses ClusterRole pv-lister" test "$(k get clusterrolebinding ci-pv-lister -o jsonpath='{.roleRef.name}')" = pv-lister
check 1 "ci can list PersistentVolumes" can list persistentvolumes --as=$SA
check 1 "but not delete them" bash -c 'k get clusterrole pv-lister && cannot delete persistentvolumes --as=$SA'

task 5 20
check 1 "RoleBinding auditors-view gives group auditors the view role" test "$(k get rolebinding auditors-view -n web -o jsonpath='{.roleRef.name} {.subjects[0].kind} {.subjects[0].name}')" = "view Group auditors"
check 1 "auditors can list pods in web only" bash -c 'can list pods -n web --as=anyone --as-group=auditors && cannot list pods -n default --as=anyone --as-group=auditors'
CHECKS
