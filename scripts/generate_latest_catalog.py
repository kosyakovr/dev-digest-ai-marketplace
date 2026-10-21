#!/usr/bin/env python3
"""Print the latest channel's marketplace.json, generated from the working tree.

Every plugin under plugins/ is listed by relative path, with its description
and `metadata.category` from plugin.json; owner and description come from
the stable catalog (docs/specs/release-channels.md, R4). CI publishes the
result on branch `latest` (scripts/build_latest_branch.sh); nobody edits it.

Usage: python3 scripts/generate_latest_catalog.py > marketplace.json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import channels  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent

if __name__ == "__main__":
    stable = json.loads((ROOT / ".claude-plugin" / "marketplace.json").read_text(encoding="utf-8"))
    print(json.dumps(channels.latest_catalog(ROOT, stable), indent=2, ensure_ascii=False))
