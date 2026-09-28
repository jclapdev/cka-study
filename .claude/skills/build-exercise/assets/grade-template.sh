#!/usr/bin/env bash
# Grades the <topic> Practice it on the running lab. Run on the Mac.
# One `task` per Practice it task, with its weight; one `check` per sub-task.
# Checks inspect only the final state, never how it was reached.
source "$(dirname "$0")/../../lab/grade-lib.sh"
grade <<'CHECKS'
task 1 25
check 1 "namespace <ns> exists" k get ns <ns>
check 2 "Deployment <name> runs <image>" test "$(k get deploy <name> -n <ns> -o jsonpath='{.spec.template.spec.containers[0].image}')" = "<image>"

task 2 75
check 1 "the kubelet on node01 is active" ssh node01 systemctl is-active kubelet
CHECKS
