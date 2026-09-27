#!/usr/bin/env bash
# Installs Helm on controlplane, as the exam has it preinstalled.
# Run on the Mac after restoring and starting the cluster starting state.
set -euo pipefail
limactl shell --workdir / controlplane bash -eo pipefail -c '
  command -v helm >/dev/null || curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-4 | bash
  helm version
'
