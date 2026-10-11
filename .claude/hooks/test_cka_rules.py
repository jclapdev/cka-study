#!/usr/bin/env python3
"""Self-check for cka-rules.py: each rule blocks the bad case and passes the good one."""
import datetime
import json
import os
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
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    for name, inp in calls:
        f.write(json.dumps({"type": "assistant", "timestamp": now, "message": {"content": [
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

# Each reader stamps the pages it read and cleared in its own file, and a page it flagged stays unstamped.
os.environ["CKA_STATE"] = state = tempfile.mkdtemp()
pages = transcript(("Read", {"file_path": f"{CWD}/references/pod.md"}), ("Read", {"file_path": f"{CWD}/references/rbac.md"}))
verdict = 'FINDING references/rbac.md:3 | counts | "one" | why\nVERDICT: 1 findings'
for reader in ("cold-reader", "style-reader"):
    run("SubagentStop", agent_type=reader, agent_transcript_path=pages, last_assistant_message=verdict)
style = json.load(open(f"{state}/style-read.json"))
assert "references/pod.md" in style and "references/rbac.md" not in style
assert json.load(open(f"{state}/cold-read.json")) == style

# Vale fails a page that uses a banned phrase.
bad = Path(CWD) / "references" / "zz-vale-check.md"
bad.write_text("# Check\n\nThe chart sets one value.\n")
try:
    assert "EmptyCount" in subprocess.run(["vale", "--output=line", str(bad)], cwd=CWD, capture_output=True, text=True).stdout
finally:
    bad.unlink()
print("all checks pass")
