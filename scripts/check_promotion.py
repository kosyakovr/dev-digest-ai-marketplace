#!/usr/bin/env python3
"""Fail a pull request that changes stable pins outside the promotion rules.

A promotion moves one plugin's pin in `.claude-plugin/marketplace.json`, or
adds one, to a later commit on main, and changes nothing else apart from the
generated version tables (docs/specs/release-channels.md, R11). Moving a pin
backwards or removing an entry is a rollback and needs "rollback" in the PR
title. A pull request that changes no pin passes.

Usage: PR_TITLE="<title>" python3 scripts/check_promotion.py <base-ref> [--root <repo>]   (base e.g. origin/main)
Test: python3 scripts/test_check_marketplace.py (offline).
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import channels  # noqa: E402

ROOT = (Path(sys.argv[sys.argv.index("--root") + 1]) if "--root" in sys.argv
        else Path(__file__).parent.parent).resolve()
CATALOG = ".claude-plugin/marketplace.json"
# Files a promotion may change: the catalog, and the version tables generate_catalog.py writes.
PROMOTION_FILES = {CATALOG, "README.md", "docs/RELEASES.md"}


def pins(catalog: dict) -> dict[str, str]:
    return {e["name"]: e["source"]["sha"] for e in catalog.get("plugins", []) if channels.is_pin(e)}


def main() -> int:
    args = [a for i, a in enumerate(sys.argv[1:], 1) if a != "--root" and sys.argv[i - 1] != "--root"]
    if len(args) != 1:
        print(__doc__)
        return 2
    merge_base = channels.git(ROOT, "merge-base", args[0], "HEAD").strip()
    try:
        before = pins(json.loads(channels.git(ROOT, "show", f"{merge_base}:{CATALOG}")))
    except subprocess.CalledProcessError:
        before = {}
    after = pins(json.loads((ROOT / CATALOG).read_text(encoding="utf-8")))
    if not before:
        print("Base catalog has no pins: not a promotion (the switch to pins is reviewed as a whole).")
        return 0

    changed = sorted(n for n in set(before) | set(after) if before.get(n) != after.get(n))
    if not changed:
        print("No pin changed: not a promotion.")
        return 0

    title = os.environ.get("PR_TITLE", "")
    rollback = "rollback" in title.lower()
    failures = []
    if len(changed) > 1:
        failures.append(f"a promotion changes one plugin's pin; this one changes {changed}")
    files = set(channels.git(ROOT, "diff", "--name-only", f"{merge_base}...HEAD").split())
    if files - PROMOTION_FILES:
        failures.append(f"a promotion changes only the stable catalog and the generated tables; also changed: {sorted(files - PROMOTION_FILES)}")
    for name in changed:
        old, new = before.get(name), after.get(name)
        if new is None and not rollback:
            failures.append(f"{name}: removing a stable entry is a rollback; put 'rollback' in the PR title")
        elif old and new and not channels.is_ancestor(ROOT, old, new) and not rollback:
            failures.append(f"{name}: {new[:12]} is not later than {old[:12]}; moving a pin back is a rollback, "
                            "put 'rollback' in the PR title")
        else:
            print(f"{name}: {(old or 'new')[:12]} -> {(new or 'removed')[:12]}" + (" (rollback)" if rollback else ""))

    for failure in failures:
        print(f"::error file={CATALOG}::{failure}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
