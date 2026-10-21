#!/usr/bin/env python3
"""Pin plugins in the stable catalog at a commit on main: a promotion.

Adds an entry for a plugin the stable catalog does not list yet, or moves an
existing entry's `sha`. The entry's description and category come from the
plugin's plugin.json at that commit, so the entry always matches what it pins
(docs/specs/release-channels.md, R1, R11).

Usage: python3 scripts/pin_stable.py <commit> <plugin>...
       python3 scripts/pin_stable.py <commit> --all    # every plugin already listed (the switch to pins, R18)
Then run check_marketplace.py and generate_catalog.py, and open one PR per plugin.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import channels  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
MARKETPLACE = ROOT / ".claude-plugin" / "marketplace.json"


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__)
        return 2
    sha = channels.git(ROOT, "rev-parse", "--verify", f"{argv[0]}^{{commit}}").strip()
    catalog = json.loads(MARKETPLACE.read_text(encoding="utf-8"))
    entries = {entry["name"]: entry for entry in catalog["plugins"]}
    names = sorted(entries) if argv[1:] == ["--all"] else argv[1:]

    for name in names:
        manifest = channels.manifest_at(ROOT, sha, name)
        if manifest is None:
            print(f"{name}: no plugins/{name}/.claude-plugin/plugin.json at {sha[:12]}")
            return 1
        entry = entries.setdefault(name, {"name": name})
        entry["source"] = {"source": "git-subdir", "url": channels.REPO_URL, "path": f"plugins/{name}",
                           "ref": channels.MAIN_BRANCH, "sha": sha}
        entry["description"] = manifest.get("description", "")
        entry["category"] = (manifest.get("metadata") or {}).get("category", "")
        print(f"{name}: pinned at {sha[:12]} ({manifest.get('version')})")

    catalog["plugins"] = [entries[name] for name in sorted(entries)]
    MARKETPLACE.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
