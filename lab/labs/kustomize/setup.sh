#!/usr/bin/env bash
# Places the files Practice it task 3 hands over, as the exam does under /opt/course.
# Runs once on the cluster lab; lab/lab.sh saves the result as this lab.
set -euo pipefail
docker exec -i -u ubuntu -w /home/ubuntu controlplane bash -eo pipefail -c '
  sudo rm -rf /opt/course/3 && sudo mkdir -p /opt/course/3/base /opt/course/3/overlay
  sudo chown -R "$(id -u):$(id -g)" /opt/course
  cd /opt/course/3
  kubectl create deployment api --image=nginx:1.27 --dry-run=client -o yaml > base/deployment.yaml
  printf "resources:\n- deployment.yaml\n" > base/kustomization.yaml
  kubectl create namespace tools --dry-run=client -o yaml > overlay/namespace.yaml
  printf "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: tools-api\nspec:\n  replicas: 2\n" > overlay/replicas.yaml
  printf "resources:\n- ../base\n- namespace.yaml\nnamespace: tools\nnamePrefix: tools-\npatches:\n  - path: replicas.yaml\n" > overlay/kustomization.yaml
  find /opt/course/3 -type f | sort
'
