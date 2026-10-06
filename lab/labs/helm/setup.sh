#!/usr/bin/env bash
# Installs Helm on controlplane, as the exam has it preinstalled, and the release
# Practice it task 5 has to find: podinfo 6.14.0 as `legacy`, from the chart's OCI
# address so no repository is added.
# Runs once on the cluster lab; lab/lab.sh saves the result as this lab.
set -euo pipefail
docker exec -i -u ubuntu -w /home/ubuntu controlplane bash -eo pipefail -c '
  command -v helm >/dev/null || curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-4 | bash
  helm status legacy -n legacy >/dev/null 2>&1 ||
    helm install legacy oci://ghcr.io/stefanprodan/charts/podinfo --version 6.14.0 -n legacy --create-namespace >/dev/null
  helm version
'
