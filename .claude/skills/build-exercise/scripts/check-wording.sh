#!/usr/bin/env bash
# Reports text the app shows that describes the lab, the machine it runs on, or the author's
# own test runs, and exam coaching with no fact in it. Each line printed is file:line:text.
# Checks every page the app shows and the strings in app/app. Exits 1 if anything is found.
# Usage: check-wording.sh   (run from anywhere in the repo)
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 2

PATTERNS='in this lab|in the lab|the lab.s |this lab |grade the run|timed (task|run)|time pressure|the way a grader|192\.168\.104\.|john|terms-demo|arm64|not used by anything in this course'

files=$(ls README.md EXAM.md lab/README.md references/*.md learn/*.md [0-9][0-9]-*/[0-9][0-9]-*/README.md 2>/dev/null)
if grep -n -i -E "$PATTERNS" $files; then found=1; else found=0; fi
# App strings: lines with text between tags or in quotes, not imports or class names.
if grep -rn -i -E "$PATTERNS" app/app | grep -v -E 'import |className='; then found=1; fi
exit $found
