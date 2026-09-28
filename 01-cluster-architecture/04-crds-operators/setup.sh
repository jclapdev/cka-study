#!/usr/bin/env bash
# Installs Helm on controlplane, as the exam has it preinstalled, and creates the
# /opt/course folders Practice it writes into.
# Run on the Mac by lab/start.sh, after it restores and starts the cluster starting state.
set -euo pipefail
limactl shell --workdir / controlplane bash -eo pipefail -c '
  command -v helm >/dev/null || curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-4 | bash >/dev/null
  sudo mkdir -p /opt/course/2 /opt/course/3 && sudo chown -R "$(id -u):$(id -g)" /opt/course
  helm version --short
' 2> >(grep -v "PS1: unbound" >&2)
