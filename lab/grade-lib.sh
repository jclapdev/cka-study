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

grade() {
  limactl shell --workdir / controlplane bash -s < <(cat <<'LIB'
exec 2>/dev/null   # a check reports ✓ or ✗; its errors are noise
k() { kubectl "$@"; }
# -n: ssh must not read the rest of this script from stdin
ssh() { command ssh -n -o BatchMode=yes "$@"; }
export -f k ssh   # visible inside `bash -c` checks too
T=0; W=0; GOT=0; MAX=0; TOTAL=0
end_task() {
  [ "$T" = 0 ] && return
  local s=0; [ "$MAX" -gt 0 ] && s=$(awk -v w="$W" -v g="$GOT" -v m="$MAX" 'BEGIN{printf "%.1f", w*g/m}')
  printf '   task %s: %s of %s%%\n\n' "$T" "$s" "$W"
  TOTAL=$(awk -v t="$TOTAL" -v s="$s" 'BEGIN{print t+s}')
}
task() { end_task; T=$1; W=$2; GOT=0; MAX=0; printf 'Task %s (%s%%)\n' "$1" "$2"; }
check() {
  local pts=$1 what=$2; shift 2
  MAX=$((MAX + pts))
  if ( "$@" ) >/dev/null 2>&1; then GOT=$((GOT + pts)); printf '  ✓ %s\n' "$what"
  else printf '  ✗ %s\n' "$what"; fi
}
finish() {
  end_task
  awk -v t="$TOTAL" 'BEGIN{printf "Score: %.0f%% — %s (pass mark 66%%)\n", t, (t >= 66 ? "PASS" : "FAIL")}'
}
LIB
    cat
    echo finish
  ) 2> >(grep -vE 'PS1: unbound|job control|process group' >&2)
}
