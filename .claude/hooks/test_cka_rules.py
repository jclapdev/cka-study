#!/usr/bin/env python3
"""Self-check for cka-rules.py: each rule blocks the bad case and passes the good one."""
import json
import subprocess
import tempfile
from pathlib import Path

HOOK = Path(__file__).with_name("cka-rules.py")
CWD = str(HOOK.parents[2])


def run(event, **data):
    out = subprocess.run([HOOK], input=json.dumps({"hook_event_name": event, "cwd": CWD, **data}),
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out) if out.strip() else {}


def transcript(*calls):
    f = tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False)
    for name, inp in calls:
        f.write(json.dumps({"type": "assistant", "message": {"content": [
            {"type": "tool_use", "name": name, "input": inp}]}}) + "\n")
    f.close()
    return f.name


def decision(out):
    return out.get("hookSpecificOutput", {}).get("permissionDecision")


bash = lambda c: run("PreToolUse", tool_name="Bash", tool_input={"command": c})
assert decision(bash("rm -rf 02-workloads-scheduling/01-deployments")) == "ask"
assert decision(bash("rm -r 02-workloads-scheduling")) == "ask"
assert decision(bash("rm app/build/x.js")) is None
assert decision(bash("echo 02-workloads-scheduling")) is None

none, loaded = transcript(), transcript(("Skill", {"skill": "build-exercise"}))
edit = lambda path, t: run("PreToolUse", tool_name="Edit", transcript_path=t, tool_input={"file_path": f"{CWD}/{path}"})
assert decision(edit("01-cluster-architecture/02-helm/README.md", none)) == "deny"
assert decision(edit("references/kubectl.md", none)) == "deny"
assert decision(edit("01-cluster-architecture/02-helm/README.md", loaded)) is None
assert decision(edit("app/app/root.tsx", none)) is None

sweep = run("PostToolUse", tool_name="Edit", tool_input={"file_path": f"{CWD}/.claude/skills/build-exercise/SKILL.md"})
assert "standard just changed" in sweep["hookSpecificOutput"]["additionalContext"]
assert run("PostToolUse", tool_name="Edit", tool_input={"file_path": f"{CWD}/README.md"}) == {}

app_edit = ("Edit", {"file_path": f"{CWD}/app/app/root.tsx"})
visit = ("mcp__Claude_Browser__navigate", {"url": "http://localhost:5199/"})
stop = lambda t, msg="Done.\nresult: x", active=False: run(
    "Stop", transcript_path=t, last_assistant_message=msg, stop_hook_active=active)
assert "browser" in stop(transcript(app_edit)).get("reason", "")
assert "browser" not in stop(transcript(app_edit, visit)).get("reason", "")
assert "browser" in stop(transcript(visit, app_edit)).get("reason", "")
assert stop(transcript(app_edit), msg="Still working on it.") == {}
assert stop(transcript(app_edit), active=True) == {}
print("all checks pass")
