#!/usr/bin/env bash
# Stands in for lab/lab.sh in the situation tests: no Docker, a start takes a second, and
# machines.json beside it says what the machines run. A lab named in fail.txt fails to start.
here=$(cd "$(dirname "$0")" && pwd)
case "${1:-}" in
  start)
    sleep 1
    grep -qx "$2" "$here/fail.txt" 2>/dev/null && exit 1
    printf '{"lab":"%s","up":true}' "$2" > "$here/machines.json" ;;
  stop) printf '{"lab":null,"up":false}' > "$here/machines.json" ;;
esac
