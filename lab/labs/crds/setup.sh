#!/usr/bin/env bash
# Installs Helm on controlplane, as the exam has it preinstalled, and creates the
# /opt/course folders Practice it writes into.
# Runs once on the cluster lab; lab/lab.sh saves the result as this lab.
set -euo pipefail
docker exec -i -u ubuntu -w /home/ubuntu controlplane bash -eo pipefail -c '
  command -v helm >/dev/null || curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-4 | bash >/dev/null
  sudo mkdir -p /opt/course/2 /opt/course/3 && sudo chown -R "$(id -u):$(id -g)" /opt/course
  helm version --short
'
