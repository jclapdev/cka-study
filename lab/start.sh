#!/usr/bin/env bash
# Puts the lab into a starting state and starts all four machines. Run on the
# Mac; the study app's Prepare lab button runs this too.
#
#   lab/start.sh <state>      vms, cluster, helm, kustomize or crds
#
# Each state is a saved copy (lab/snapshot.sh), plus the topic's setup.sh when
# a restore alone is not enough. Whatever is on the machines is thrown away.
set -euo pipefail
cd "$(dirname "$0")/.."

case "${1:-}" in
  vms)       copy=clean; setup="" ;;
  cluster)   copy=built; setup="" ;;
  helm)      copy=built; setup=01-cluster-architecture/02-helm/setup.sh ;;
  kustomize) copy=built; setup=01-cluster-architecture/03-kustomize/setup.sh ;;
  crds)      copy=built; setup=01-cluster-architecture/04-crds-operators/setup.sh ;;
  *) echo "usage: $0 <state>, one of: vms cluster helm kustomize crds"; exit 1 ;;
esac

lab/snapshot.sh restore "$copy"
for vm in controlplane node01 node02 base; do
  echo "== starting $vm"
  limactl start "$vm" >/dev/null 2>&1 || { echo "$vm did not start"; exit 1; }
done
[ -z "$setup" ] || "$setup"
echo
echo "Ready. Open the terminal, or from the Mac: limactl shell base"
