#!/usr/bin/env python3
"""Hook: hold cka-prep work to the rules agreed with the user, whether or not Claude recalls them.

- PreToolUse Bash (rm, git rm, mv): the empty domain and topic folders are the list of
  exercises still to build, so removing or renaming one goes to the user first.
- PreToolUse Edit|Write: exercises, Learn and reference pages, and labs are written with
  the build-exercise skill loaded, since that is where their rules live.
- PostToolUse Edit|Write on the build-exercise skill: a changed standard is applied to the
  pages already written, in the same task.
- Stop: a reply that reports `result:` is held back until the work is in the user's
  checkout on main, pushed, any app change has been seen in a browser on port 5199, and
  every changed learner page has passed both readers.
- SubagentStop (cold-reader, style-reader): stamps each page the reader read in full and
  found clear, in that reader's own stamp file.
- `cka-rules.py prepush` (from .githooks/pre-push): git refuses to push a changed learner
  page that fails Vale or lacks a current stamp from either reader, however the push was started.
- PreToolUse guards: the stamp file can't be written, and the git hook can't be skipped.
"""
import datetime
import difflib
import json
import os
import re
import shlex
import subprocess
import sys

CHECKOUT = "/Users/john/projects/cka-prep"
APP_URL = "5199"
STATE = os.environ.get("CKA_STATE", f"{CHECKOUT}/.claude/state")
# Each reader that must clear a learner page before it is pushed, and its stamp file.
READERS = {"cold-reader": "cold-read.json", "style-reader": "style-read.json"}
FOLDER = re.compile(r"^\d\d-[^/]+(/\d\d-[^/]+)?$")
SKILL_PAGES = re.compile(r"^(\d\d-[^/]+/\d\d-[^/]+/README\.md|learn/.+\.md|references/.+\.md|lab/labs/.+)$")
LEARNER_PAGES = re.compile(r"^(\d\d-[^/]+/\d\d-[^/]+/README\.md|learn/.+\.md|references/.+\.md|EXAM\.md|CHANGELOG\.md|README\.md|lab/README\.md)$")
# What a learner sees: a push that changes any of it adds a line to CHANGELOG.md, shown as What's new.
LEARNER_VISIBLE = re.compile(r"^(app/app/.+|\d\d-[^/]+/\d\d-[^/]+/README\.md|learn/.+\.md|references/.+\.md|EXAM\.md|lab/README\.md)$")
GATE_FILES = re.compile(r"(^|/)(\.githooks/|\.claude/hooks/|\.claude/settings[^/]*\.json$)")


def repo_path(cwd, path):
    root = cwd.split("/.claude/worktrees/")[0]
    full = os.path.normpath(os.path.join(cwd, path))
    m = re.match(re.escape(root) + r"(/\.claude/worktrees/[^/]+)?/(.*)", full)
    return m.group(2) if m else None


def decide(decision, reason):
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse", "permissionDecision": decision,
        "permissionDecisionReason": reason}}))


def folder_guard(data):
    cmd = data["tool_input"].get("command", "")
    if not re.search(r"\b(rm|mv)\b", cmd):  # the `if` filter runs the hook on commands it can't parse
        return
    try:
        words = shlex.split(cmd)
    except ValueError:
        return
    hits = [w for w in words if not w.startswith("-") and FOLDER.match(repo_path(data["cwd"], w) or "")]
    if hits:
        decide("ask", "These are topic folders, the list of exercises still to build: "
               + ", ".join(hits) + ". Removing or renaming one needs the user's yes.")
        return True


def skill_loaded(transcript):
    try:
        text = open(transcript).read()
    except OSError:
        return True  # no transcript to check, don't block on it
    return bool(re.search(r'"skill":\s*"build-exercise"|<command-name>/build-exercise', text))


def skill_gate(data):
    path = data["tool_input"].get("file_path", "")
    rel = repo_path(data["cwd"], path)
    if "/.claude/state/" in path:
        decide("deny", "The cold-reader stamps are written only by the reviewer's stop hook.")
    elif rel and GATE_FILES.search(rel):
        decide("ask", f"{rel} is part of the gate that checks Claude's work. Changing it needs the user's yes.")
    elif rel and SKILL_PAGES.match(rel) and not skill_loaded(data["transcript_path"]):
        decide("deny", f"{rel} is written with the build-exercise skill. Load it with the "
               "Skill tool first, then make this edit following it.")


def push_guard(data):
    """The pre-push hook and the stamps are the gate, so Claude can't switch either off."""
    cmd = data["tool_input"].get("command", "")
    if "--no-verify" in cmd or re.search(r"core\.hooksPath(?!\s+\.githooks\b)", cmd):
        decide("deny", "The git hooks check every push. --no-verify and changing core.hooksPath "
               "are for the user to run in their own terminal.")
    elif ".claude/state" in cmd or "cold-read.json" in cmd:
        decide("deny", "The cold-reader stamps are written only by the reviewer's stop hook.")


def standards_sweep(data):
    rel = repo_path(data["cwd"], data["tool_input"].get("file_path", "")) or ""
    if rel.startswith(".claude/skills/build-exercise/"):
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": "The build-exercise standard just changed. Once the user has "
            "agreed it, every written topic, Learn page and reference page is brought in line "
            "with it in this same task, without asking."}}))


def tool_calls(transcript, with_time=False):
    for line in open(transcript):
        try:
            entry = json.loads(line)
        except ValueError:
            continue
        content = entry.get("message", {}).get("content")
        if entry.get("type") == "assistant" and isinstance(content, list):
            for c in content:
                if c.get("type") == "tool_use":
                    yield (c, entry.get("timestamp", "")) if with_time else c


APP_SOURCE = re.compile(r"app/app/[\w/.-]+\.(tsx?|css)")
READ_ONLY = re.compile(r"^\s*(cd [^;&]+&&\s*)?(grep|rg|cat|ls|head|tail|wc|sed -n|git (diff|log|status|show))\b")


def browser_check(data):
    """App edited, but no browser visit to the running app since the last app edit.

    ponytail: an edit counts when the call names an app source file (Edit/Write paths, a Write
    of an edits file, a Bash command), so an edit script that never names its files is missed.
    """
    seen = None
    for call in tool_calls(data["transcript_path"]):
        name, args = call["name"], json.dumps(call["input"])
        if name in ("Edit", "Write", "MultiEdit") and "/app/" in call["input"].get("file_path", "") \
                or name in ("Write", "Bash") and APP_SOURCE.search(args) \
                and not (name == "Bash" and READ_ONLY.match(call["input"].get("command", ""))):
            seen = False
        elif seen is False and APP_URL in args and (re.search("browser|chrome", name, re.I)
                                                    or name == "Bash" and re.search(r"\bnode\b|playwright", args)):
            seen = True
    if seen is False:
        return (f"The app changed this session but hasn't been clicked through in a browser "
                f"on localhost:{APP_URL} since the last change. Drive it in a real browser: "
                "every control the change touches, repeated quickly, and the failure paths.")


def git(*args):
    return subprocess.run(["git", "-C", CHECKOUT, *args], capture_output=True, text=True).stdout.strip()


def main_check():
    problems = []
    if git("branch", "--show-current") != "main":
        problems.append(f"{CHECKOUT} is not on main")
    if git("rev-parse", "main") != git("rev-parse", "origin/main"):
        problems.append("main and origin/main differ (pull or push)")
    unmerged = git("branch", "--no-merged", "main")
    if unmerged:
        problems.append("branches with commits not on main: " + ", ".join(unmerged.replace("+", "").split()))
    if problems:
        return ("The work isn't done until it is on main in the user's checkout, pushed, and "
                "visible in the running app: " + "; ".join(problems) + ".")


def stamp_file(reader):
    return os.path.join(STATE, READERS[reader])


def load_stamps(reader):
    try:
        return json.load(open(stamp_file(reader)))
    except (OSError, ValueError):
        return {}


def blob(path):
    # -w keeps the stamped version in git's object store, so the next packet can diff against it.
    return subprocess.run(["git", "-C", os.path.dirname(path), "hash-object", "-w", path],
                          capture_output=True, text=True).stdout.strip()


CONTEXT = 12  # lines kept on each side of a change, enough for its step and the one before


def packet_dir(reader):
    return os.path.join(STATE, "packets", reader)


def git_text(root, *args):
    out = subprocess.run(["git", "-C", root, *args], capture_output=True, text=True)
    return out.stdout if out.returncode == 0 else None


def packet(root, reader, rel):
    """Write the sections of a page this reader hasn't cleared and return the packet's path,
    or None when the reader already cleared this version. A section is the opening or one `##`
    heading's lines; it is in the packet when a line in it changed since the reader's last
    stamp, or since origin/main when it has none. `>` marks each changed line."""
    path = os.path.join(root, rel)
    current, stamped = blob(path), load_stamps(reader).get(rel)
    if stamped == current:
        return None
    base = (stamped and git_text(root, "cat-file", "-p", stamped)) or git_text(root, "show", f"origin/main:{rel}")
    lines = open(path).read().splitlines() or [""]
    if base is None:
        changed = set(range(len(lines)))
    else:
        changed = set()
        matcher = difflib.SequenceMatcher(None, base.splitlines(), lines, autojunk=False)
        for op, _, _, j1, j2 in matcher.get_opcodes():
            if op != "equal":  # a deletion marks the line after it
                changed.update(range(j1, j2) if j2 > j1 else [min(j1, len(lines) - 1)])
    starts, fence = [0], False
    for i, line in enumerate(lines):
        fence ^= line.lstrip().startswith("```")
        if i and not fence and line.startswith("## "):
            starts.append(i)
    starts.append(len(lines))
    old_heads = set(base.splitlines()) if base is not None else set()
    out = [f"PACKET {rel} {current} {path}",
           f"Sections of {rel} changed since this reader last cleared it. `>` marks a changed line. "
           "A section marked NEW did not exist before and is shown whole; elsewhere `...` marks lines left out."]
    for a, b in zip(starts, starts[1:]):
        if changed.intersection(range(a, b)):
            new = base is None or (lines[a].startswith("## ") and lines[a] not in old_heads)
            out.append(f"\n=== {rel} lines {a + 1}-{b}{' NEW' if new else ''} ===")
            # A new section goes in whole; an old one keeps its heading and the lines near each change.
            keep = range(a, b) if new else sorted({a} | {i for c in changed.intersection(range(a, b))
                                                         for i in range(max(a, c - CONTEXT), min(b, c + CONTEXT + 1))})
            last = None
            for i in keep:
                if last is not None and i > last + 1:
                    out.append("  ...")
                out.append(f"{i + 1:>5}{'>' if i in changed else ' '} {lines[i]}")
                last = i
    target = os.path.join(packet_dir(reader), rel.replace("/", "__"))
    os.makedirs(packet_dir(reader), exist_ok=True)
    with open(target, "w") as f:
        f.write("\n".join(out) + "\n")
    return target


def packets(pages):
    """Print each reader's packet paths for the given pages, relative to the repo root."""
    root = (git_text(os.getcwd(), "rev-parse", "--show-toplevel") or os.getcwd()).strip()
    for reader in READERS:
        made = [p for p in (packet(root, reader, rel) for rel in pages) if p]
        print(f"{reader}: " + (" ".join(made) if made else "already clear"))


def epoch(timestamp):
    try:
        return datetime.datetime.fromisoformat(timestamp.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return 0


def stamp(data):
    """A reader finished: stamp each learner page it read, has no finding on, and that
    hasn't changed since it was read. No verdict line, no stamps."""
    reader = data["agent_type"]
    message = data.get("last_assistant_message", "")
    if "VERDICT:" not in message:
        # A background reader delivers its report through a SubagentHandback call instead.
        handbacks = [c["input"].get("message", "") for c in tool_calls(data["agent_transcript_path"])
                     if c["name"] == "SubagentHandback"]
        message = handbacks[-1] if handbacks else message
    if not re.search(r"^VERDICT: (clear|\d+ findings?)\s*$", message.strip().splitlines()[-1] if message.strip() else ""):
        return
    flagged = set(re.findall(r"^FINDING (\S+?):\d+ \| ", message, re.M))
    read = {}
    for call, ts in tool_calls(data["agent_transcript_path"], with_time=True):
        path = call["input"].get("file_path", "")
        if call["name"] == "Read" and "offset" not in call["input"] and "limit" not in call["input"]:
            read[path] = epoch(ts)
    stamps = load_stamps(reader)
    for path in [p for p in read if os.path.dirname(p) == packet_dir(reader)]:
        # A packet read in full stands for its page, while the page is still the version it was built from.
        try:
            _, rel, built, page = open(path).readline().split(" ", 3)
        except (OSError, ValueError):
            continue
        page = page.strip()
        if rel not in flagged and os.path.exists(page) and blob(page) == built:
            stamps[rel] = built
    for path, read_at in read.items():
        rel = repo_path(data["cwd"], path)
        if rel and LEARNER_PAGES.match(rel) and rel not in flagged and os.path.exists(path) \
                and os.path.getmtime(path) <= read_at + 1:
            stamps[rel] = blob(path)
    os.makedirs(STATE, exist_ok=True)
    json.dump(stamps, open(stamp_file(reader), "w"), indent=1, sort_keys=True)


def unreviewed(pages_with_blobs):
    """'<page> (<reader>)' for each reader whose stamp on the page is missing or stale."""
    missing = []
    for reader in READERS:
        stamps = load_stamps(reader)
        missing += [f"{rel} ({reader})" for rel, b in pages_with_blobs if stamps.get(rel) != b]
    return missing


def vale(root, pages):
    """Vale's errors on these pages (the rules in .vale/styles/CKA), or '' when they pass."""
    pages = [p for p in pages if os.path.exists(os.path.join(root, p))]
    if not pages:
        return ""
    try:
        out = subprocess.run(["vale", "--output=line", *pages], cwd=root, capture_output=True, text=True)
    except FileNotFoundError:
        return "vale is not installed (brew install vale)"
    return (out.stdout + out.stderr).strip() if out.returncode else ""


def prepush():
    """Run by .githooks/pre-push with git's '<local ref> <local sha> <remote ref> <remote sha>' lines."""
    zero = "0" * 40
    missing, changed_pages, unlogged = set(), set(), set()
    for line in sys.stdin:
        local_ref, local_sha, _, remote_sha = line.split()
        if local_sha == zero:
            continue  # deleting a branch
        base = remote_sha if remote_sha != zero else "origin/main"
        changed = subprocess.run(["git", "diff", "--name-only", "--diff-filter=d", f"{base}..{local_sha}"],
                                 capture_output=True, text=True).stdout.split()
        pages = [(p, subprocess.run(["git", "rev-parse", f"{local_sha}:{p}"], capture_output=True, text=True).stdout.strip())
                 for p in changed if LEARNER_PAGES.match(p)]
        missing.update(unreviewed(pages))
        changed_pages.update(p for p, _ in pages)
        if "CHANGELOG.md" not in changed:
            unlogged.update(p for p in changed if LEARNER_VISIBLE.match(p))
    root = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True).stdout.strip()
    errors = vale(root, sorted(changed_pages))
    if errors:
        print("Vale found wording these pages must not use:\n" + errors, file=sys.stderr)
    if missing:
        print("These learner pages changed but haven't passed the reader named beside them:\n  "
              + "\n  ".join(sorted(missing))
              + "\nBuild their packets with `python3 .claude/hooks/cka-rules.py packet <pages>`, give each "
              "reader its packet paths, fix what it finds, and push again.", file=sys.stderr)
    if unlogged:
        print("These files change what a learner sees, but CHANGELOG.md has no new line for them:\n  "
              + "\n  ".join(sorted(unlogged))
              + "\nAdd a dated line saying what changed, in the learner's words, and push again.", file=sys.stderr)
    if errors or missing or unlogged:
        sys.exit(1)


def review_check(data):
    """Learner pages that differ from origin/main in the working copy and aren't stamped."""
    root = subprocess.run(["git", "-C", data["cwd"], "rev-parse", "--show-toplevel"], capture_output=True, text=True).stdout.strip()
    if not root:
        return
    changed = subprocess.run(["git", "-C", root, "diff", "--name-only", "--diff-filter=d", "origin/main"],
                             capture_output=True, text=True).stdout.split()
    pages = [(p, blob(os.path.join(root, p))) for p in changed if LEARNER_PAGES.match(p)]
    problems = []
    missing = unreviewed(pages)
    if missing:
        problems.append("These learner pages haven't passed the reader named beside them since they "
                        "last changed: " + ", ".join(missing) + ". Build their packets with `python3 "
                        ".claude/hooks/cka-rules.py packet <pages>`, give each reader its packet paths, "
                        "and fix what it finds.")
    errors = vale(root, [p for p, _ in pages])
    if errors:
        problems.append("Vale found wording these pages must not use:\n" + errors)
    return "\n".join(problems) or None


def done_gate(data):
    # No stop_hook_active early return: Claude Code ends the turn after eight blocks in a row.
    if not re.search(r"^result:", data.get("last_assistant_message", ""), re.M):
        return
    reasons = [r for r in (review_check(data), browser_check(data), main_check()) if r]
    if reasons:
        print(json.dumps({"decision": "block", "reason": "\n".join(reasons)}))


def main():
    if sys.argv[1:] == ["prepush"]:
        return prepush()
    if sys.argv[1:2] == ["packet"]:
        return packets(sys.argv[2:])
    data = json.load(sys.stdin)
    event, tool = data["hook_event_name"], data.get("tool_name")
    if event == "PreToolUse" and tool == "Bash":
        folder_guard(data) or push_guard(data)
    elif event == "PreToolUse":
        skill_gate(data)
    elif event == "PostToolUse":
        standards_sweep(data)
    elif event == "Stop":
        done_gate(data)
    elif event == "SubagentStop" and data.get("agent_type") in READERS:
        stamp(data)


if __name__ == "__main__":
    main()
