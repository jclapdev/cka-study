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
  every changed learner page has passed the cold-reader.
- SubagentStop (cold-reader): stamps each page the reviewer read in full and found clear.
- `cka-rules.py prepush` (from .githooks/pre-push): git refuses to push a changed learner
  page without a current stamp, however the push was started.
- PreToolUse guards: the stamp file can't be written, and the git hook can't be skipped.
"""
import datetime
import json
import os
import re
import shlex
import subprocess
import sys

CHECKOUT = "/Users/john/projects/cka-prep"
APP_URL = "5199"
STAMPS = os.environ.get("CKA_STAMPS", f"{CHECKOUT}/.claude/state/cold-read.json")
FOLDER = re.compile(r"^\d\d-[^/]+(/\d\d-[^/]+)?$")
SKILL_PAGES = re.compile(r"^(\d\d-[^/]+/\d\d-[^/]+/README\.md|learn/.+\.md|references/.+\.md|lab/labs/.+)$")
LEARNER_PAGES = re.compile(r"^(\d\d-[^/]+/\d\d-[^/]+/README\.md|learn/.+\.md|references/.+\.md|EXAM\.md|README\.md|lab/README\.md)$")
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


def load_stamps():
    try:
        return json.load(open(STAMPS))
    except (OSError, ValueError):
        return {}


def blob(path):
    return subprocess.run(["git", "hash-object", path], capture_output=True, text=True).stdout.strip()


def epoch(timestamp):
    try:
        return datetime.datetime.fromisoformat(timestamp.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return 0


def stamp(data):
    """The cold-reader finished: stamp each learner page it read, has no finding on, and that
    hasn't changed since it was read. No verdict line, no stamps."""
    message = data.get("last_assistant_message", "")
    if not re.search(r"^VERDICT: (clear|\d+ findings?)\s*$", message.strip().splitlines()[-1] if message.strip() else ""):
        return
    flagged = set(re.findall(r"^FINDING (\S+?):\d+ \| failure [1-5] \| \"", message, re.M))
    read = {}
    for call, ts in tool_calls(data["agent_transcript_path"], with_time=True):
        path = call["input"].get("file_path", "")
        if call["name"] == "Read" and "offset" not in call["input"] and "limit" not in call["input"]:
            read[path] = epoch(ts)
    stamps = load_stamps()
    for path, read_at in read.items():
        rel = repo_path(data["cwd"], path)
        if rel and LEARNER_PAGES.match(rel) and rel not in flagged and os.path.exists(path) \
                and os.path.getmtime(path) <= read_at + 1:
            stamps[rel] = blob(path)
    os.makedirs(os.path.dirname(STAMPS), exist_ok=True)
    json.dump(stamps, open(STAMPS, "w"), indent=1, sort_keys=True)


def unreviewed(pages_with_blobs):
    stamps = load_stamps()
    return [rel for rel, b in pages_with_blobs if stamps.get(rel) != b]


def prepush():
    """Run by .githooks/pre-push with git's '<local ref> <local sha> <remote ref> <remote sha>' lines."""
    zero = "0" * 40
    missing = set()
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
    if missing:
        print("These learner pages changed but haven't passed the cold-reader:\n  " + "\n  ".join(sorted(missing))
              + "\nRun the cold-reader agent on them, fix what it finds, and push again.", file=sys.stderr)
        sys.exit(1)


def review_check(data):
    """Learner pages that differ from origin/main in the working copy and aren't stamped."""
    root = subprocess.run(["git", "-C", data["cwd"], "rev-parse", "--show-toplevel"], capture_output=True, text=True).stdout.strip()
    if not root:
        return
    changed = subprocess.run(["git", "-C", root, "diff", "--name-only", "--diff-filter=d", "origin/main"],
                             capture_output=True, text=True).stdout.split()
    pages = [(p, blob(os.path.join(root, p))) for p in changed if LEARNER_PAGES.match(p)]
    missing = unreviewed(pages)
    if missing:
        return ("These learner pages haven't passed the cold-reader since they last changed: "
                + ", ".join(missing) + ". Run the cold-reader agent on them and fix what it finds.")


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
    elif event == "SubagentStop" and data.get("agent_type") == "cold-reader":
        stamp(data)


if __name__ == "__main__":
    main()
