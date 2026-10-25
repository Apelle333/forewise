"""Fault injection into temporary installations, never the actual cached skill."""

import hashlib
import importlib.util
import io
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

SPEC = importlib.util.spec_from_file_location(
    "hallmark_install", Path(__file__).with_name("install-hallmark.py")
)
installer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(installer)


class InstallationIntegrity(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="forewise-hallmark-test-")
        self.addCleanup(self.temp.cleanup)
        self.dest = Path(self.temp.name) / "skill"
        self.files = {
            "SKILL.md": b"skill",
            "scripts/sloplint.mjs": b"lint",
            "scripts/sloplint-render.mjs": b"render",
            "references/rules.md": b"rules",
        }
        self.lock = {"revision": "test-revision", "skillPath": "skills/hallmark"}
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as z:
            for name, content in self.files.items():
                z.writestr(f"hallmark-test-revision/skills/hallmark/{name}", content)
        self.archive = buffer.getvalue()
        self.lock["archiveSha256"] = hashlib.sha256(self.archive).hexdigest()
        installer.install(self.dest, self.lock, self.files)

    def marker(self, mutate):
        path = self.dest / ".source.json"
        data = json.loads(path.read_bytes())
        mutate(data)
        path.write_text(json.dumps(data))

    def test_verified_release_and_idempotent_install(self):
        self.assertEqual(installer.release_files(self.archive, self.lock), self.files)
        before = {str(p): p.read_bytes() for p in self.dest.rglob("*") if p.is_file()}
        installer.install(self.dest, self.lock, self.files)
        self.assertEqual(
            before, {str(p): p.read_bytes() for p in self.dest.rglob("*") if p.is_file()}
        )

    def test_empty_inventory_rejected(self):
        self.marker(lambda m: m.update(files={}))
        with self.assertRaisesRegex(ValueError, "inventory"):
            installer.install(self.dest, self.lock, self.files)

    def test_partial_inventory_rejected(self):
        self.marker(lambda m: m["files"].pop("SKILL.md"))
        with self.assertRaises(ValueError):
            installer.verify_installation(self.dest, self.lock, self.files)

    def test_modified_manifest_hash_rejected(self):
        self.marker(lambda m: m["files"].update({"SKILL.md": "0" * 64}))
        with self.assertRaises(ValueError):
            installer.verify_installation(self.dest, self.lock, self.files)

    def test_unexpected_inventory_entry_rejected(self):
        self.marker(lambda m: m["files"].update({"unexpected.txt": "0" * 64}))
        with self.assertRaises(ValueError):
            installer.verify_installation(self.dest, self.lock, self.files)

    def test_nested_marker_is_an_unexpected_file(self):
        (self.dest / "references/.source.json").write_text("{}")
        with self.assertRaises(ValueError):
            installer.verify_installation(self.dest, self.lock, self.files)

    def test_modified_file_even_with_updated_manifest_rejected(self):
        (self.dest / "SKILL.md").write_bytes(b"modified")
        self.marker(lambda m: m["files"].update({"SKILL.md": installer.digest(b"modified")}))
        with self.assertRaises(ValueError):
            installer.verify_installation(self.dest, self.lock, self.files)

    def test_missing_file_rejected(self):
        (self.dest / "SKILL.md").unlink()
        with self.assertRaises(ValueError):
            installer.verify_installation(self.dest, self.lock, self.files)

    def test_unexpected_file_rejected(self):
        (self.dest / "extra.txt").write_bytes(b"unexpected")
        with self.assertRaises(ValueError):
            installer.verify_installation(self.dest, self.lock, self.files)

    def test_modified_file_rejected(self):
        (self.dest / "SKILL.md").write_bytes(b"modified")
        with self.assertRaises(ValueError):
            installer.verify_installation(self.dest, self.lock, self.files)

    def test_changed_archive_rejected(self):
        with self.assertRaisesRegex(ValueError, "fingerprint"):
            installer.release_files(self.archive + b"changed", self.lock)

    def test_initial_conflicting_work_preserved(self):
        (self.dest / ".source.json").unlink()
        (self.dest / "SKILL.md").write_bytes(b"local edits")
        with self.assertRaises(ValueError):
            installer.install(self.dest, self.lock, self.files)
        self.assertEqual((self.dest / "SKILL.md").read_bytes(), b"local edits")


if __name__ == "__main__":
    unittest.main()
