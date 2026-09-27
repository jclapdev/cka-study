#!/usr/bin/env bash
# Opens every https link in the Markdown files given and reports whether it loads.
# For kubernetes.io links with a #fragment, also checks that the page has that anchor.
# Usage: check-doc-links.sh FILE.md [FILE.md ...]   Exits 1 if any link fails.
set -uo pipefail
[ $# -gt 0 ] || { echo "usage: $0 FILE.md [FILE.md ...]" >&2; exit 2; }

page=$(mktemp); trap 'rm -f "$page"' EXIT
fail=0
for url in $(grep -ohE 'https://[^) >"`]+' "$@" | sort -u); do
  base=${url%%#*}; frag=""; [ "$base" != "$url" ] && frag=${url#*#}
  code=$(curl -sL -o "$page" -w '%{http_code}' "$base")
  if [ "$code" != 200 ]; then
    echo "FAIL $code $url"; fail=1
  elif [ -n "$frag" ] && [[ $base == https://kubernetes.io/* ]] && ! grep -qE "id=\"?$frag\"?[ >]" "$page"; then
    echo "FAIL no anchor #$frag  $url"; fail=1
  else
    echo "OK   $url"
  fi
done
exit $fail
