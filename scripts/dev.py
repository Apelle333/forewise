"""Start both local processes with a shared generated service token."""
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import sys
import time

root = Path(__file__).resolve().parents[1]
env_file = root / "apps/web/.env.local"
if not env_file.exists():
    env_file.write_text(
        "FORECAST_SERVICE_URL=http://127.0.0.1:8001\n"
        f"FORECAST_SERVICE_TOKEN={secrets.token_hex(32)}\n", encoding="utf-8"
    )
env = dict(os.environ)
for line in env_file.read_text(encoding="utf-8").splitlines():
    if line and not line.startswith("#") and "=" in line:
        key, value = line.split("=", 1)
        env.setdefault(key, value)
python = root / (".venv/Scripts/python.exe" if os.name == "nt" else ".venv/bin/python")
if not python.exists():
    sys.exit("Create .venv and install services/forecast/requirements.txt first. See README.md.")
flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
processes = []
try:
    processes.append(subprocess.Popen(
        [str(python), "-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", "8001"],
        cwd=root / "services/forecast", env=env, creationflags=flags,
    ))
    processes.append(subprocess.Popen(
        [shutil.which("node") or "node", str(root / "node_modules/next/dist/bin/next"),
         "start" if "--production" in sys.argv else "dev", "--hostname", "127.0.0.1"],
        cwd=root / "apps/web", env=env, creationflags=flags,
    ))
    while all(p.poll() is None for p in processes):
        time.sleep(0.5)
except KeyboardInterrupt:
    pass
finally:
    for process in processes:
        if process.poll() is None:
            if os.name == "nt":
                subprocess.run(
                    ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                    capture_output=True, creationflags=flags,
                )
            else:
                process.terminate()
    for process in processes:
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
