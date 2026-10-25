"""Project-local pinned Hallmark installation; no hooks, global settings or API calls."""

import hashlib
import io
import json
import stat
import urllib.request
import zipfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
LOCK = json.loads((ROOT / "docs/design/hallmark/source.json").read_text(encoding="utf-8"))
DEST = ROOT / ".data/tools/hallmark"
MARKER = DEST / ".source.json"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    if MARKER.exists():
        installed = json.loads(MARKER.read_bytes())
        if installed["revision"] != LOCK["revision"]:
            raise SystemExit(
                "Hallmark revision differs; review the upgrade without overwriting it."
            )
        for name, expected in installed["files"].items():
            if digest((DEST / name).read_bytes()) != expected:
                raise SystemExit(f"Installed Hallmark file changed: {name}")
        print(f"Verified project Hallmark {LOCK['version']} at {LOCK['revision'][:12]}")
        return
    archive = ROOT / ".data/hallmark-source.zip"
    if not archive.exists():
        url = f"https://codeload.github.com/Nutlope/hallmark/zip/{LOCK['revision']}"
        archive.parent.mkdir(parents=True, exist_ok=True)
        archive.write_bytes(urllib.request.urlopen(url, timeout=90).read())
    data = archive.read_bytes()
    if digest(data) != LOCK["archiveSha256"]:
        raise SystemExit("Hallmark archive fingerprint differs; installation stopped.")
    prefix = f"hallmark-{LOCK['revision']}/{LOCK['skillPath']}/"
    files = {}
    with zipfile.ZipFile(io.BytesIO(data)) as source:
        for entry in source.infolist():
            if not entry.filename.startswith(prefix) or entry.is_dir():
                continue
            relative = PurePosixPath(entry.filename[len(prefix) :])
            if (
                relative.is_absolute()
                or ".." in relative.parts
                or any(":" in p for p in relative.parts)
            ):
                raise SystemExit("Unsafe archive path")
            if stat.S_ISLNK(entry.external_attr >> 16):
                raise SystemExit("Unexpected archive symlink")
            target = DEST.joinpath(*relative.parts)
            target.resolve().relative_to(DEST.resolve())
            content = source.read(entry)
            if target.exists() and target.read_bytes() != content:
                raise SystemExit(f"Existing skill file differs; preserved: {relative}")
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists():
                target.write_bytes(content)
            files[str(relative)] = digest(content)
    if "SKILL.md" not in files or "scripts/sloplint.mjs" not in files:
        raise SystemExit("Incomplete Hallmark payload")
    MARKER.write_bytes(
        (json.dumps({"revision": LOCK["revision"], "files": files}, indent=2) + "\n").encode()
    )
    print(f"Installed/verified project Hallmark {LOCK['version']}: {len(files)} pinned files")


if __name__ == "__main__":
    main()
