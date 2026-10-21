#!/usr/bin/env python3
"""Offline checks for check_marketplace.py (same directory).

Each case builds a small marketplace in a temporary directory, runs the
checker on it with --root, and compares the exit code and the reported
errors. A check with no failing case is not a check, so every rule below
has a planted hit; the clean case must pass.

Usage: python3 scripts/test_check_marketplace.py
Exit code 0 = every case passed, 1 = at least one failed.
"""
from __future__ import annotations

import copy
import json
import subprocess
import sys
import tempfile
from pathlib import Path

CHECKER = Path(__file__).resolve().parent / "check_marketplace.py"

BASE = {
    "marketplace": {"name": "fixture", "owner": {"name": "test"}, "plugins": [
        {"name": "app", "source": "./plugins/app", "description": "App.", "category": "development"},
        {"name": "lib", "source": "./plugins/lib", "description": "Lib.", "category": "development"},
    ]},
    "plugins": {
        "app": {"name": "app", "version": "1.0.0", "description": "App.", "dependencies": ["lib"],
                "metadata": {"category": "development", "compat": {"lib": "^1.0.0"}}},
        "lib": {"name": "lib", "version": "1.2.0", "description": "Lib.", "metadata": {"category": "development"}},
    },
}


def build(root: Path, spec: dict) -> None:
    (root / ".claude-plugin").mkdir(parents=True)
    (root / ".claude-plugin" / "marketplace.json").write_text(json.dumps(spec["marketplace"]))
    for name, manifest in spec["plugins"].items():
        plugin = root / "plugins" / name
        (plugin / ".claude-plugin").mkdir(parents=True)
        (plugin / ".claude-plugin" / "plugin.json").write_text(json.dumps(manifest))
        (plugin / "README.md").write_text(f"# {name}\n")
        (plugin / "LICENSE").write_text("MIT\n")
        (plugin / "CHANGELOG.md").write_text(f"# Changelog\n\n## [{manifest['version']}]\n")


def run(spec: dict) -> tuple[int, list[str]]:
    with tempfile.TemporaryDirectory() as tmp:
        build(Path(tmp), spec)
        proc = subprocess.run([sys.executable, "-I", str(CHECKER), "--root", tmp], capture_output=True, text=True)
    return proc.returncode, [line.removeprefix("::error::") for line in proc.stdout.splitlines() if line.startswith("::error::")]


def variant(edit) -> dict:
    spec = copy.deepcopy(BASE)
    edit(spec)
    return spec


def app(spec: dict) -> dict:
    return spec["plugins"]["app"]


CASES: list[tuple[str, dict, list[str]]] = [
    ("clean", BASE, []),
    ("ranged-dependency-object",
     variant(lambda s: app(s).update(dependencies=[{"name": "lib", "version": "^1.0.0"}])),
     ["fixture: plugins/app: dependency {'name': 'lib', 'version': '^1.0.0'} must be a bare plugin name; put its range in metadata.compat",
      "fixture: plugins/app: metadata.compat names 'lib', which is not in dependencies"]),
    ("dependency-not-in-catalog",
     variant(lambda s: app(s).update(dependencies=["lib", "ghost"]) or app(s)["metadata"]["compat"].update(ghost="^1.0.0")),
     ["fixture: plugins/app: dependency 'ghost' is not in this catalog"]),
    ("incompatible-version",
     variant(lambda s: app(s)["metadata"]["compat"].update(lib="^2.0.0")),
     ["fixture: plugins/app: lib 1.2.0 is outside its range ^2.0.0 in metadata.compat"]),
    ("range-in-another-form",
     variant(lambda s: app(s)["metadata"]["compat"].update(lib="~1.2.0")),
     ["fixture: plugins/app: metadata.compat range lib '~1.2.0' must have the form ^X.Y.Z"]),
    ("missing-range",
     variant(lambda s: app(s)["metadata"].pop("compat")),
     ["fixture: plugins/app: dependency 'lib' has no range in metadata.compat"]),
    ("range-for-a-non-dependency",
     variant(lambda s: app(s)["metadata"]["compat"].update(extra="^1.0.0")),
     ["fixture: plugins/app: metadata.compat names 'extra', which is not in dependencies"]),
    ("missing-category",
     variant(lambda s: s["plugins"]["lib"]["metadata"].pop("category")),
     ["plugins/lib/.claude-plugin/plugin.json: metadata.category is missing"]),
    ("category-differs-from-entry",
     variant(lambda s: s["plugins"]["lib"]["metadata"].update(category="research")),
     ["plugins/lib/.claude-plugin/plugin.json: metadata.category 'research' differs from the marketplace entry"]),
]


def main() -> int:
    failed = 0
    for name, spec, want in CASES:
        code, got = run(spec)
        want_code = 1 if want else 0
        if code != want_code or sorted(got) != sorted(want):
            failed += 1
            print(f"FAIL {name}: exit {code} (want {want_code})\n  got:  {got}\n  want: {want}")
    print(f"check_marketplace: {len(CASES) - failed} passed, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
