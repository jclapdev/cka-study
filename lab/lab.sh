#!/usr/bin/env bash
# The lab's one command. The app runs it for you; without the app, run it through the
# app's container so it works the same on every system:
#
#   docker compose exec app lab/lab.sh start <lab>     a folder in lab/labs, such as cluster or helm
#   docker compose exec app lab/lab.sh rebuild <lab>   throws away that lab's saved copy, then starts it
#   docker compose exec app lab/lab.sh status
#   docker compose exec app lab/lab.sh stop
#
# Each lab is a folder in lab/labs. Its `base` file names the lab it builds on, and its
# setup.sh, if any, runs on top of that lab. A lab with no `base` file starts from
# freshly built machines (tag `clean`).
#
# The first start of a lab saves the result as a docker image per machine,
# cka-<machine>:<lab>, labelled with a hash of the lab's setup and everything it builds
# on. Later starts restore that copy. Editing a setup.sh changes the hash, so that lab and
# every lab above it are set up again on their next start.
set -euo pipefail
cd "$(dirname "$0")/.."
NODES=(controlplane node01 node02)

from() { cat "lab/labs/$1/base" 2>/dev/null || true; }
sum() { if command -v sha256sum >/dev/null; then sha256sum; else shasum -a 256; fi | cut -c1-12; }
hash() {
  local parent; parent=$(from "$1")
  { if [ -n "$parent" ]; then hash "$parent"; else cat lab/Dockerfile; fi
    echo "$parent"; cat "lab/labs/$1/setup.sh" 2>/dev/null || true; } | sum
}
saved() {
  for n in "${NODES[@]}"; do
    [ "$(docker image inspect -f '{{index .Config.Labels "cka.hash"}}' "cka-$n:$1" 2>/dev/null)" = "$2" ] || return 1
  done
}

# Recreates the machines from a copy. Whatever is on them is thrown away.
up() {
  COPY=$1 docker compose up -d --no-build --pull never --force-recreate "${NODES[@]}" base
  for n in "${NODES[@]}"; do docker exec "$n" systemctl is-system-running --wait >/dev/null || true; done
  docker exec -u ubuntu -w /home/ubuntu controlplane bash -c 'test -f ~/.kube/config || exit 0
    timeout 180 bash -c "until kubectl get --raw /readyz >/dev/null 2>&1; do sleep 2; done"' || echo "the API server did not come back within 3 minutes"
}

# Leaves the machines running <lab>, setting it up and saving it first if needed.
start() {
  local lab=$1 want parent
  want=$(hash "$lab")
  if saved "$lab" "$want"; then
    echo "== starting the $lab lab"
    up "$lab"
    return
  fi
  parent=$(from "$lab")
  if [ -n "$parent" ]; then
    start "$parent"
  else
    echo "== building the machines"
    docker compose build "${NODES[@]}" base
    up clean
  fi
  if [ -x "lab/labs/$lab/setup.sh" ]; then
    echo "== setting up the $lab lab"
    "lab/labs/$lab/setup.sh"
  fi
  echo "== saving the $lab lab"
  docker compose stop -t 30 "${NODES[@]}"
  for n in "${NODES[@]}"; do docker commit --change "LABEL cka.hash=$want" "$n" "cka-$n:$lab" >/dev/null; done
  # Recreated from the copy just saved, so the machines' image names the lab they run.
  up "$lab"
}

lab=${2:-}
case "${1:-}" in
  start | rebuild)
    [ -n "$lab" ] && [ -d "lab/labs/$lab" ] || { echo "usage: $0 $1 <lab>, one of: $(cd lab/labs && ls -d */ | tr -d / | tr '\n' ' ')"; exit 1; }
    [ "$1" = start ] || for n in "${NODES[@]}"; do docker image rm "cka-$n:$lab" >/dev/null 2>&1 || true; done
    start "$lab"
    echo
    echo "Ready."
    ;;
  status) docker inspect -f '{{.Name}} {{.Config.Image}} {{.State.Status}} since {{.State.StartedAt}}' "${NODES[@]}" base 2>/dev/null || true ;;
  stop) docker compose stop "${NODES[@]}" base ;;
  *) echo "usage: $0 {start <lab>|rebuild <lab>|status|stop}"; exit 1 ;;
esac
