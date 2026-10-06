#!/usr/bin/env bash
# Pulls the control plane images on every node, so kubeadm init is fast enough that it
# never times out waiting. Runs once on freshly built machines.
set -euo pipefail
for n in controlplane node01 node02; do
  echo "== pulling the control plane images on $n"
  docker exec -i -u ubuntu "$n" bash -c 'sudo kubeadm config images pull --kubernetes-version "$(kubeadm version -o short)" >/dev/null'
done
