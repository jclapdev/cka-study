#!/usr/bin/env python3
"""Hook: hold cka-prep work to the rules agreed with the user, whether or not Claude recalls them.

- PreToolUse Bash (rm, git rm, mv): the empty domain and topic folders are the list of
  exercises still to build, so removing or renaming one goes to the user first.
- PreToolUse Edit|Write: exercises, Learn and reference pages, and labs are written with
  the build-exercise skill loaded, since that is where their rules live.
- PostToolUse Edit|Write on the build-exercise skill: a changed standard is applied to the
  pages already written, in the same task.
- Stop: a reply that reports `result:` is held back until the work is in the user's
  checkout on main, pushed, and any app change has been seen in a browser on port 5199.
"""
import json
import os
import re
import shlex
import subprocess
import sys

CHECKOUT = "/Users/john/projects/cka-prep"
APP_URL = "5199"
FOLDER = re.compile(r"^\d\d-[^/]+(/\d\d-[^/]+)?$")
SKILL_PAGES = re.compile(r"^(\d\d-[^/]+/\d\d-[^/]+/README\.md|learn/.+\.md|references/.+\.md|lab/labs/.+)$")


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


def skill_loaded(transcript):
    try:
        text = open(transcript).read()
    except OSError:
        return True  # no transcript to check, don't block on it
    return bool(re.search(r'"skill":\s*"build-exercise"|<command-name>/build-exercise', text))


def skill_gate(data):
    rel = repo_path(data["cwd"], data["tool_input"].get("file_path", ""))
    if rel and SKILL_PAGES.match(rel) and not skill_loaded(data["transcript_path"]):
        decide("deny", f"{rel} is written with the build-exercise skill. Load it with the "
               "Skill tool first, then make this edit following it.")


def standards_sweep(data):
    rel = repo_path(data["cwd"], data["tool_input"].get("file_path", "")) or ""
    if rel.startswith(".claude/skills/build-exercise/"):
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": "The build-exercise standard just changed. Once the user has "
            "agreed it, every written topic, Learn page and reference page is brought in line "
            "with it in this same task, without asking."}}))


def tool_calls(transcript):
    for line in open(transcript):
        try:
            entry = json.loads(line)
        except ValueError:
            continue
        content = entry.get("message", {}).get("content")
        if entry.get("type") == "assistant" and isinstance(content, list):
            yield from (c for c in content if c.get("type") == "tool_use")


def browser_check(data):
    """App edited, but no browser visit to the running app since the last app edit."""
    seen = None
    for call in tool_calls(data["transcript_path"]):
        path = call["input"].get("file_path", "")
        if call["name"] in ("Edit", "Write", "MultiEdit") and "/app/" in path:
            seen = False
        elif seen is False and re.search("browser|chrome", call["name"], re.I) \
                and APP_URL in json.dumps(call["input"]):
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


def done_gate(data):
    if data.get("stop_hook_active") or not re.search(r"^result:", data.get("last_assistant_message", ""), re.M):
        return
    reasons = [r for r in (browser_check(data), main_check()) if r]
    if reasons:
        print(json.dumps({"decision": "block", "reason": "\n".join(reasons)}))


def main():
    data = json.load(sys.stdin)
    event, tool = data["hook_event_name"], data.get("tool_name")
    if event == "PreToolUse" and tool == "Bash":
        folder_guard(data)
    elif event == "PreToolUse":
        skill_gate(data)
    elif event == "PostToolUse":
        standards_sweep(data)
    elif event == "Stop":
        done_gate(data)


if __name__ == "__main__":
    main()
