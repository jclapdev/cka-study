#!/usr/bin/env bash
# The lab's one command. The app runs it for you; without the app, run it through the
# app's container so it works the same on every system:
#
#   docker compose exec app lab/lab.sh setup         builds the machines and a working cluster, and saves both
#   docker compose exec app lab/lab.sh start <lab>   vms, cluster, helm, kustomize or crds
#   docker compose exec app lab/lab.sh save <name>   saves controlplane, node01 and node02 under a name
#   docker compose exec app lab/lab.sh stop
#
# A saved copy is a docker image per machine, cka-<machine>:<name>. `clean` is bare
# machines with the Kubernetes tools and images. `built` is a working cluster.
set -euo pipefail
cd "$(dirname "$0")/.."
NODES=(controlplane node01 node02)
FLANNEL=https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml

on() { docker exec -i -u ubuntu -w /home/ubuntu "$1" bash -c "$2"; }

# Recreates the machines from a saved copy. Whatever is on them is thrown away.
up() {
  for n in "${NODES[@]}"; do
    docker image inspect "cka-$n:$1" >/dev/null 2>&1 || { echo "no saved copy $1: run lab/lab.sh setup first"; exit 1; }
  done
  COPY=$1 docker compose up -d --no-build --pull never --force-recreate "${NODES[@]}" base
  for n in "${NODES[@]}"; do docker exec "$n" systemctl is-system-running --wait >/dev/null || true; done
  on controlplane 'test -f ~/.kube/config || exit 0
    timeout 180 bash -c "until kubectl get --raw /readyz >/dev/null 2>&1; do sleep 2; done"' || echo "the API server did not come back within 3 minutes"
}

save() {
  docker compose stop -t 30 "${NODES[@]}"
  for n in "${NODES[@]}"; do
    echo "== saving $n as cka-$n:$1"
    docker commit "$n" "cka-$n:$1" >/dev/null
  done
  docker compose start "${NODES[@]}"
}

case "${1:-}" in
  setup)
    docker compose build controlplane node01 node02 base
    up clean
    # Pulled images make kubeadm init fast enough that it never times out waiting.
    for n in "${NODES[@]}"; do
      echo "== pulling the control plane images on $n"
      on "$n" 'sudo kubeadm config images pull --kubernetes-version "$(kubeadm version -o short)" >/dev/null'
    done
    save clean
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
    save built
    ;;
  start)
    case "${2:-}" in
      vms)       copy=clean; setup="" ;;
      cluster)   copy=built; setup="" ;;
      helm)      copy=built; setup=01-cluster-architecture/02-helm/setup.sh ;;
      kustomize) copy=built; setup=01-cluster-architecture/03-kustomize/setup.sh ;;
      crds)      copy=built; setup=01-cluster-architecture/04-crds-operators/setup.sh ;;
      *) echo "usage: $0 start <lab>, one of: vms cluster helm kustomize crds"; exit 1 ;;
    esac
    docker image inspect cka-controlplane:built >/dev/null 2>&1 || "$0" setup
    up "$copy"
    [ -z "$setup" ] || "$setup"
    echo
    echo "Ready."
    ;;
  save)
    [ -n "${2:-}" ] || { echo "usage: $0 save <name>"; exit 1; }
    save "$2"
    ;;
  stop) docker compose stop "${NODES[@]}" base ;;
  *) echo "usage: $0 {setup|start <lab>|save <name>|stop}"; exit 1 ;;
esac
