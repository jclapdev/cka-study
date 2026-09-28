#!/usr/bin/env bash
# Opens every https link in the Markdown files given and reports whether it loads.
# URLs in code (fenced blocks and `inline` spans) are command arguments, not links, and are skipped.
# For kubernetes.io and helm.sh links with a #fragment, also checks that the page has that anchor.
# In an exercise README or a references/ page, a link outside the docs the exam allows is
# reported NOT ALLOWED unless its line says "(not available in the exam)".
# Usage: check-doc-links.sh FILE.md [FILE.md ...]   Exits 1 if any link fails.
set -uo pipefail
[ $# -gt 0 ] || { echo "usage: $0 FILE.md [FILE.md ...]" >&2; exit 2; }

ALLOWED='^https://(kubernetes\.io/(docs|blog)|helm\.sh/docs|gateway-api\.sigs\.k8s\.io)'
prose() { awk '/^ *```/{c=!c; next} !c' "$@" | sed 's/`[^`]*`//g'; }

page=$(mktemp); trap 'rm -f "$page"' EXIT
fail=0
for url in $(prose "$@" | grep -oE 'https://[^) >"`]+' | sort -u); do
  base=${url%%#*}; frag=""; [ "$base" != "$url" ] && frag=${url#*#}
  code=$(curl -sL -o "$page" -w '%{http_code}' "$base")
  if [ "$code" != 200 ]; then
    echo "FAIL $code $url"; fail=1
  elif [ -n "$frag" ] && [[ $base =~ ^https://(kubernetes\.io|helm\.sh)/ ]] && ! grep -qE "id=\"?$frag\"?[ >]" "$page"; then
    echo "FAIL no anchor #$frag  $url"; fail=1
  else
    echo "OK   $url"
  fi
done

for f in "$@"; do
  [[ $f =~ (^|/)[0-9][0-9]-[^/]+/[0-9][0-9]-[^/]+/README\.md$ || $f =~ (^|/)references/[^/]+\.md$ ]] || continue
  while IFS= read -r line; do
    case $line in *"(not available in the exam)"*) continue ;; esac
    for url in $(grep -oE 'https://[^) >"`]+' <<<"$line"); do
      [[ $url =~ $ALLOWED ]] || { echo "NOT ALLOWED $f  $url"; fail=1; }
    done
  done < <(prose "$f")
done
exit $fail
