"""Run the Phase 01 local gate; fail fast and keep evidence outside Git."""

import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

root = Path(__file__).resolve().parents[1]
os.chdir(root)
npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
uv = shutil.which("uv")
python = root / (".venv/Scripts/python.exe" if os.name == "nt" else ".venv/bin/python")
if not npm or not uv or not python.exists():
    sys.exit("Install npm, uv and the project .venv first. See README.md.")

evidence = root / ".data/checks"
evidence.mkdir(parents=True, exist_ok=True)
records = []


def run(name, command):
    print(f"Checking {name}...", flush=True)
    result = subprocess.run(
        command, capture_output=True, text=True, encoding="utf-8", errors="replace", check=False
    )
    (evidence / f"{name}.log").write_text(result.stdout + result.stderr, encoding="utf-8")
    records.append({"check": name, "exit_code": result.returncode})
    (evidence / "results.json").write_text(
        json.dumps(
            {"timestamp_utc": datetime.now(timezone.utc).isoformat(), "checks": records}, indent=2
        ),
        encoding="utf-8",
    )
    if result.returncode:
        print(result.stdout + result.stderr)
        sys.exit(result.returncode)


# Check only versioned project files, never ignored environment/credential files.
tracked = (
    subprocess.run(["git", "ls-files", "-z"], capture_output=True, check=True)
    .stdout.decode()
    .split("\0")
)
for filename in filter(None, tracked):
    parts = Path(filename).parts
    if any(
        part in {".data", ".venv", ".next", "node_modules", ".env", ".env.local"} for part in parts
    ):
        sys.exit(f"Forbidden generated/private file is tracked: {filename}")
    file = root / filename
    if file.suffix == ".png":
        continue
    content = file.read_text(encoding="utf-8-sig")
    if re.search(
        r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{50,}\b",
        content,
    ):
        sys.exit(f"Potential credential in tracked file: {filename}")
print("PASS: tracked-file credential guard", flush=True)

run("lint", [npm, "run", "lint"])
run("format", [npm, "run", "check:format"])
run("hallmark-baseline", [npm, "run", "design:check"])
run("hallmark-positive-negative-tests", [npm, "run", "test:design"])
run("python-lint", [uv, "tool", "run", "ruff==0.17.2", "check", "services/forecast", "scripts"])
run(
    "python-format",
    [uv, "tool", "run", "ruff==0.17.2", "format", "--check", "services/forecast", "scripts"],
)
run("typecheck", [npm, "run", "typecheck"])
run("unit-tests", [npm, "test"])
run("python-tests", [str(python), "-m", "pytest", "services/forecast", "-q"])
run("python-dependencies", [str(python), "-m", "pip", "check"])
run("build", [npm, "run", "build"])
run("npm-audit", [npm, "audit", "--audit-level=low"])
run(
    "python-audit",
    [uv, "tool", "run", "pip-audit==2.10.1", "-r", "services/forecast/requirements.lock.txt"],
)
print("PASS: Phase 01 source gate. Evidence: .data/checks/results.json", flush=True)
