#!/usr/bin/env python3
"""Reports links that break the linking rules in the Markdown files given.

- REPEAT: a link to a target (page and #section) that the page already linked earlier.
  Link a term only the first time it appears. In a topic README each lesson is a page.
- TRAILING: a link tacked on after a colon at the end of a sentence, as in
  "... in one namespace: [releases](helm.md#releases)." Put the link on the term instead.

Links in code blocks, web links and links in a "## Docs" or "## Further reading"
list are not checked.
Usage: check-links-once.py FILE.md [FILE.md ...]   Exits 1 if anything is reported.
"""
import re
import sys

LINK = re.compile(r"\[([^\]]+)\]\(([^)\s]+)\)")
LISTS = re.compile(r"^## (Docs|Further reading)\b")
# A topic README is split into lessons at each `##` heading, and each lesson is a page of its own.
# Objectives stays on the Introduction, and Check your work and Further reading stay on Practice.
LESSONS = re.compile(r"(^|/)\d\d-[^/]+/\d\d-[^/]+/README\.md$")
SAME_LESSON = re.compile(r"^## (Objectives|Check your work|Further reading)\b")

failed = False
for path in sys.argv[1:]:
    seen = {}
    in_code = in_list = False
    lines = open(path).read().split("\n")
    for n, line in enumerate(lines, 1):
        if line.lstrip().startswith("```"):
            in_code = not in_code
            continue
        if line.startswith("## "):
            in_list = bool(LISTS.match(line))
            if LESSONS.search(path) and not SAME_LESSON.match(line):
                seen = {}
        if in_code or in_list or line.lstrip().startswith("<summary"):
            continue
        for m in LINK.finditer(line):
            text, target = m.groups()
            if re.match(r"(https?:|#)", target):
                continue
            key = re.sub(r"^(\.\./)+", "", target)
            if key in seen:
                print(f"{path}:{n}: REPEAT [{text}] already linked on line {seen[key]}")
                failed = True
            else:
                seen[key] = n
            unquote = lambda s: re.sub(r"^\s*(>\s*)*", "", s).rstrip()  # a line inside a > note
            before = unquote(line[: m.start()])
            if not before and n > 1:
                before = unquote(lines[n - 2])
            after = line[m.end():].lstrip()
            if before.endswith(":") and (after[:1] in (".", "") or after.startswith(").")):
                print(f"{path}:{n}: TRAILING [{text}] after a colon")
                failed = True
sys.exit(1 if failed else 0)
