#!/usr/bin/env python3
"""Fail if a plugin changed since BASE without a version bump in plugin.json.

Installed plugins update only when their version changes, so a change that
ships without a bump never reaches users. README-only changes are exempt.

Usage: python3 scripts/check_version_bump.py <base-ref>   (e.g. origin/main)
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXEMPT = {"README.md"}


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, check=True).stdout


def version_tuple(version: str) -> tuple[int, ...]:
    match = re.match(r"^(\d+)\.(\d+)\.(\d+)", version)
    return tuple(map(int, match.groups())) if match else (0, 0, 0)


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    base = sys.argv[1]
    merge_base = git("merge-base", base, "HEAD").strip()
    changed = git("diff", "--name-only", f"{merge_base}...HEAD", "--", "plugins/").splitlines()

    by_plugin: dict[str, list[str]] = {}
    for path in changed:
        parts = Path(path).parts
        if len(parts) >= 3 and "/".join(parts[2:]) not in EXEMPT:
            by_plugin.setdefault(parts[1], []).append(path)

    failures = 0
    for plugin, files in sorted(by_plugin.items()):
        manifest = f"plugins/{plugin}/.claude-plugin/plugin.json"
        head_path = ROOT / manifest
        if not head_path.is_file():
            continue  # plugin removed; marketplace checks handle that
        head_version = json.loads(head_path.read_text(encoding="utf-8")).get("version", "")
        try:
            base_version = json.loads(git("show", f"{merge_base}:{manifest}")).get("version", "")
        except subprocess.CalledProcessError:
            print(f"{plugin}: new plugin at {head_version}")
            continue

        if version_tuple(head_version) <= version_tuple(base_version):
            failures += 1
            print(
                f"::error file={manifest}::{plugin} changed ({len(files)} file(s)) but version "
                f"{head_version!r} is not greater than {base_version!r}. Bump it and add a CHANGELOG entry."
            )
        else:
            print(f"{plugin}: {base_version} -> {head_version}")

    if not by_plugin:
        print("No plugin changes that require a version bump.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
