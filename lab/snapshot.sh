#!/usr/bin/env bash
# Back up / restore the lab VMs. Troubleshooting and etcd exercises break the
# cluster on purpose; this is the way back without a 20-minute reprovision.
#
#   ./snapshot.sh save clean
#   ./snapshot.sh restore clean
#   ./snapshot.sh list
#
# Uses clones, not `limactl snapshot`: snapshots need a qcow2 disk and these
# VMs run on the vz backend, which uses raw disks. Clones are stopped copies
# named <vm>-<tag>. Cloning refuses to touch a running instance, so both verbs
# stop the lab first. `save` restarts it, since work was in progress; `restore`
# leaves it stopped, because every exercise begins by starting the VMs and a
# `limactl start` on an already-running instance teaches nothing.
set -euo pipefail

VMS=(controlplane node01 node02)
ACTION="${1:-list}"
TAG="${2:-}"

# `| grep -q` would SIGPIPE limactl and, under pipefail, report every instance
# as missing. tr consumes the whole stream.
exists() {
  case " $(limactl list --format '{{.Name}}' 2>/dev/null | tr '\n' ' ') " in
    *" $1 "*) return 0 ;; *) return 1 ;;
  esac
}
status() { limactl list --format '{{.Name}} {{.Status}}' 2>/dev/null | awk -v n="$1" '$1==n{print $2}'; }

# limactl stop occasionally returns before the instance has actually gone down,
# and clone refuses a running instance — so confirm, don't assume.
stopall() {
  for vm in "${VMS[@]}"; do
    exists "$vm" || continue
    # `stop -f` powers off without a clean shutdown, so flush writes first or
    # the saved copy can miss the last minutes of changes.
    [ "$(status "$vm")" = Running ] && limactl shell --workdir / "$vm" sync >/dev/null 2>&1
    for _ in 1 2 3; do
      [ "$(status "$vm")" = Stopped ] && break
      limactl stop -f "$vm" >/dev/null 2>&1 || true
      sleep 3
    done
    [ "$(status "$vm")" = Stopped ] || { echo "could not stop $vm"; exit 1; }
  done
}
startall() { for vm in "${VMS[@]}"; do limactl start "$vm" >/dev/null 2>&1 || echo "warn: $vm did not start"; done; }

case "$ACTION" in
  list) limactl list ;;
  save)
    [ -n "$TAG" ] || { echo "usage: $0 save <tag>"; exit 1; }
    stopall
    for vm in "${VMS[@]}"; do
      exists "$vm-$TAG" && limactl delete --force "$vm-$TAG" >/dev/null
      echo "== saving $vm -> $vm-$TAG"
      limactl clone "$vm" "$vm-$TAG" >/dev/null
    done
    startall
    ;;
  restore)
    [ -n "$TAG" ] || { echo "usage: $0 restore <tag>"; exit 1; }
    for vm in "${VMS[@]}"; do
      exists "$vm-$TAG" || { echo "no backup $vm-$TAG"; exit 1; }
    done
    stopall
    for vm in "${VMS[@]}"; do
      echo "== restoring $vm from $vm-$TAG"
      exists "$vm" && limactl delete --force "$vm" >/dev/null
      limactl clone "$vm-$TAG" "$vm" >/dev/null
    done
    echo "restored, stopped. start them with: limactl start ${VMS[*]}"
    ;;
  *) echo "usage: $0 {save|restore|list} [tag]"; exit 1 ;;
esac
