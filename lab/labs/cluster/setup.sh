#!/usr/bin/env bash
# Builds a working cluster with kubeadm and Flannel, joins both workers and labels them.
# Runs once on the vms lab; lab/lab.sh saves the result as this lab.
set -euo pipefail
FLANNEL=https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml
on() { docker exec -i -u ubuntu -w /home/ubuntu "$1" bash -c "$2"; }

echo "== kubeadm init on controlplane"
on controlplane "sudo kubeadm init --apiserver-advertise-address \$(ip route get 1.1.1.1 | awk '{print \$7; exit}') \
    --pod-network-cidr 10.244.0.0/16 >/dev/null
  mkdir -p ~/.kube && sudo cp /etc/kubernetes/admin.conf ~/.kube/config && sudo chown ubuntu: ~/.kube/config
  kubectl apply -f $FLANNEL >/dev/null"
join=$(on controlplane "sudo kubeadm token create --print-join-command")
for n in node01 node02; do
  echo "== joining $n"
  on "$n" "sudo $join >/dev/null"
done
on controlplane "kubectl label node node01 node02 node-role.kubernetes.io/worker= >/dev/null
  kubectl wait --for=condition=Ready node --all --timeout=5m && kubectl get nodes"
