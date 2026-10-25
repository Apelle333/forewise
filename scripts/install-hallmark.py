"""Pinned project-local installation; cache metadata is never its own trust anchor."""

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


def digest(data):
    return hashlib.sha256(data).hexdigest()


def release_files(data, lock):
    if digest(data) != lock["archiveSha256"]:
        raise ValueError("Hallmark archive fingerprint differs; installation stopped.")
    prefix = f"hallmark-{lock['revision']}/{lock['skillPath']}/"
    files = {}
    with zipfile.ZipFile(io.BytesIO(data)) as source:
        for entry in source.infolist():
            if not entry.filename.startswith(prefix) or entry.is_dir():
                continue
            name = entry.filename[len(prefix) :]
            relative = PurePosixPath(name)
            if (
                relative.is_absolute()
                or ".." in relative.parts
                or "\\" in name
                or any(":" in p for p in relative.parts)
                or name in files
                or stat.S_ISLNK(entry.external_attr >> 16)
            ):
                raise ValueError("Unsafe or duplicate archive path")
            files[name] = source.read(entry)
    if not {"SKILL.md", "scripts/sloplint.mjs", "scripts/sloplint-render.mjs"} <= files.keys():
        raise ValueError("Incomplete pinned Hallmark release")
    return files


def check_tree(dest, files, complete):
    if dest.is_symlink():
        raise ValueError("Skill directory cannot be a symlink")
    actual = set()
    for target in dest.rglob("*"):
        if target.is_symlink():
            raise ValueError("Installed skill contains a symlink")
        if target.is_file() and target.relative_to(dest).as_posix() != ".source.json":
            actual.add(target.relative_to(dest).as_posix())
    if actual - files.keys() or (complete and actual != files.keys()):
        raise ValueError("Installed skill has missing or unexpected files")
    for name in actual:
        if (dest / name).read_bytes() != files[name]:
            raise ValueError(f"Installed Hallmark file changed: {name}")


def verify_installation(dest, lock, files):
    marker = dest / ".source.json"
    installed = json.loads(marker.read_bytes())
    expected = {name: digest(content) for name, content in files.items()}
    if (
        not isinstance(installed, dict)
        or set(installed) != {"revision", "files"}
        or installed["revision"] != lock["revision"]
        or installed["files"] != expected
    ):
        raise ValueError("Cached inventory differs from the complete pinned release")
    check_tree(dest, files, complete=True)


def install(dest, lock, files):
    if (dest / ".source.json").exists():
        verify_installation(dest, lock, files)
        return
    # Preflight everything before writing. Preserve conflicting local work.
    check_tree(dest, files, complete=False)
    for name, content in files.items():
        target = dest / name
        target.resolve().relative_to(dest.resolve())
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            target.write_bytes(content)
    (dest / ".source.json").write_bytes(
        (
            json.dumps(
                {
                    "revision": lock["revision"],
                    "files": {name: digest(content) for name, content in files.items()},
                },
                indent=2,
            )
            + "\n"
        ).encode()
    )
    verify_installation(dest, lock, files)


def main():
    archive = ROOT / ".data/hallmark-source.zip"
    if not archive.exists():
        url = f"https://codeload.github.com/Nutlope/hallmark/zip/{LOCK['revision']}"
        archive.parent.mkdir(parents=True, exist_ok=True)
        archive.write_bytes(urllib.request.urlopen(url, timeout=60).read())
    # Recheck the trusted archive and complete inventory on every cached invocation.
    files = release_files(archive.read_bytes(), LOCK)
    install(DEST, LOCK, files)
    print(f"Verified Hallmark {LOCK['version']} at {LOCK['revision']}: {len(files)} exact files")


if __name__ == "__main__":
    main()
