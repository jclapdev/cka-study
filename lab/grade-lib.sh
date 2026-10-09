# Shared by every topic's grade.sh. A grade.sh sources this file and pipes its
# checks to `grade`:
#
#   source "$(dirname "$0")/../../lab/grade-lib.sh"
#   grade <<'CHECKS'
#   task 1 20                                   # task number and its weight in %
#   check 2 "namespace store exists" k get ns store
#   check 1 "3 replicas" test "$(k get deploy x -n store -o jsonpath='{.spec.replicas}')" = 3
#   CHECKS
#
# `check <points> "<what>" <command...>` passes when the command exits 0. Each
# task scores its weight times the share of its points that passed, the way the
# exam gives partial credit per sub-task. Checks run on controlplane as the lab
# user; `ssh node01 …` reaches a worker. Only the final state is inspected.
# GRADE_TASK=<n> runs only task n's checks.
#
# controlplane has no key for the workers, as in the exam, so for the run the
# grader lends it base's key, which every lab machine accepts, and deletes it
# afterwards.

grade() {
  [[ ${GRADE_TASK:-} =~ ^[0-9]*$ ]] || { echo "GRADE_TASK must be a task number" >&2; return 2; }
  docker exec base cat .ssh/id_ed25519 | docker exec -i -u ubuntu controlplane bash -c 'umask 077; cat > /tmp/cka-grader-key'
  trap 'docker exec controlplane rm -f /tmp/cka-grader-key' EXIT
  docker exec -i -u ubuntu -w /home/ubuntu controlplane bash -s < <(cat <<'LIB'
exec 2>/dev/null   # a check reports ✓ or ✗; its errors are noise
k() { kubectl "$@"; }
# -n: ssh must not read the rest of this script from stdin
ssh() {
  local host=$1; shift
  command ssh -n -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    -o LogLevel=ERROR -i /tmp/cka-grader-key "$host" "$@"
}
export -f k ssh   # visible inside `bash -c` checks too
T=0; W=0; GOT=0; MAX=0; TOTAL=0; SKIP=0
end_task() {
  [ "$T" = 0 ] || [ "$SKIP" = 1 ] && return
  local s=0; [ "$MAX" -gt 0 ] && s=$(awk -v w="$W" -v g="$GOT" -v m="$MAX" 'BEGIN{printf "%.1f", w*g/m}')
  printf '   task %s: %s of %s%%\n\n' "$T" "$s" "$W"
  TOTAL=$(awk -v t="$TOTAL" -v s="$s" 'BEGIN{print t+s}')
}
task() {
  end_task; T=$1; W=$2; GOT=0; MAX=0; SKIP=0
  if [ -n "$ONLY" ] && [ "$T" != "$ONLY" ]; then SKIP=1; return; fi
  printf 'Task %s (%s%%)\n' "$1" "$2"
}
check() {
  [ "$SKIP" = 1 ] && return
  local pts=$1 what=$2; shift 2
  MAX=$((MAX + pts))
  if ( "$@" ) >/dev/null 2>&1; then GOT=$((GOT + pts)); printf '  ✓ %s\n' "$what"
  else printf '  ✗ %s\n' "$what"; fi
}
finish() {
  end_task
  [ -n "$ONLY" ] && return
  awk -v t="$TOTAL" 'BEGIN{printf "Score: %.0f%% — %s (pass mark 66%%)\n", t, (t >= 66 ? "PASS" : "FAIL")}'
}
LIB
    echo "ONLY=${GRADE_TASK:-}"
    cat
    echo finish
  )
}
