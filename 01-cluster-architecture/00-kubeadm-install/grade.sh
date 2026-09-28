#!/usr/bin/env bash
# Grades the kubeadm Practice it on the running lab. Run on the Mac.
source "$(dirname "$0")/../../lab/grade-lib.sh"
grade <<'CHECKS'
task 1 19
check 1 "a control plane exists" sudo test -f /etc/kubernetes/manifests/kube-apiserver.yaml
check 1 "its pod network CIDR is 10.244.0.0/16" sudo grep -q -- "--cluster-cidr=10.244.0.0/16" /etc/kubernetes/manifests/kube-controller-manager.yaml
check 1 "the apiserver advertises controlplane's own address" bash -c 'sudo grep -q -- "--advertise-address=$(ip route get 1.1.1.1 | awk "{print \$7; exit}")\$" /etc/kubernetes/manifests/kube-apiserver.yaml'

task 2 12
check 1 "~/.kube/config belongs to the user" bash -c '[ "$(stat -c %U ~/.kube/config)" = "$(id -un)" ]'
check 1 "kubectl works without sudo or KUBECONFIG" env -u KUBECONFIG kubectl get nodes

task 3 19
check 1 "a CNI configuration exists" bash -c 'sudo ls /etc/cni/net.d/ | grep -q .'
check 1 "controlplane is Ready" bash -c '[ "$(k get node controlplane -o jsonpath="{.status.conditions[?(@.type==\"Ready\")].status}")" = True ]'
check 1 "CoreDNS is available" bash -c '[ "$(k get deploy coredns -n kube-system -o jsonpath="{.status.availableReplicas}")" = 2 ]'

task 4 25
check 1 "node01 is Ready" bash -c '[ "$(k get node node01 -o jsonpath="{.status.conditions[?(@.type==\"Ready\")].status}")" = True ]'
check 1 "node02 is Ready" bash -c '[ "$(k get node node02 -o jsonpath="{.status.conditions[?(@.type==\"Ready\")].status}")" = True ]'

task 5 12
check 1 "node01 has the worker role" bash -c 'k get node node01 --show-labels | grep -q "node-role.kubernetes.io/worker="'
check 1 "node02 has the worker role" bash -c 'k get node node02 --show-labels | grep -q "node-role.kubernetes.io/worker="'

task 6 13
check 1 "the four control plane pods are Running" bash -c 'for c in kube-apiserver kube-controller-manager kube-scheduler etcd; do [ "$(k get pod $c-controlplane -n kube-system -o jsonpath="{.status.phase}")" = Running ] || exit 1; done'
check 1 "no kube-system pod is in CrashLoopBackOff" bash -c 'k get pods -n kube-system --no-headers | grep -q . && ! k get pods -n kube-system --no-headers | grep -q CrashLoopBackOff'
CHECKS
