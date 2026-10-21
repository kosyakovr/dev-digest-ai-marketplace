"""Release channels shared by the repository scripts (docs/specs/release-channels.md).

stable: `.claude-plugin/marketplace.json` on `main`, every entry a pin
        (git-subdir of this repository at `ref: main` and a full `sha`).
latest: generated from every directory under `plugins/` and published as
        branch `latest`; never edited by hand.
"""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

STABLE_NAME = "dev-digest-ai"
LATEST_NAME = "dev-digest-ai-latest"
LATEST_BRANCH = "latest"
REPO_URL = "https://github.com/kosyakovr/dev-digest-ai-marketplace.git"
MAIN_BRANCH = "main"
SHA = re.compile(r"^[0-9a-f]{40}$")


def git(root: Path, *args: str) -> str:
    return subprocess.run(["git", "-C", str(root), *args], capture_output=True, text=True, check=True).stdout


def main_ref(root: Path) -> str:
    """`origin/main` in CI checkouts, `main` in a repository without a remote."""
    for ref in (f"origin/{MAIN_BRANCH}", MAIN_BRANCH):
        if subprocess.run(["git", "-C", str(root), "rev-parse", "--verify", "--quiet", ref],
                          capture_output=True).returncode == 0:
            return ref
    return MAIN_BRANCH


def is_pin(entry: dict) -> bool:
    source = entry.get("source")
    return isinstance(source, dict) and source.get("source") == "git-subdir"


def pin_problems(entry: dict) -> list[str]:
    """What keeps an entry from being a pin of `plugins/<name>` in this repository."""
    source, name = entry.get("source") or {}, entry.get("name")
    want = {"source": "git-subdir", "url": REPO_URL, "path": f"plugins/{name}", "ref": MAIN_BRANCH}
    problems = [f"source.{k} must be {v!r}" for k, v in want.items() if source.get(k) != v]
    if not SHA.match(str(source.get("sha", ""))):
        problems.append("source.sha must be a full 40-character lowercase commit SHA")
    extra = sorted(set(source) - set(want) - {"sha"})
    if extra:
        problems.append(f"source has unexpected keys {extra}")
    return problems


def manifest_at(root: Path, sha: str, name: str) -> dict | None:
    """`plugins/<name>/.claude-plugin/plugin.json` as committed at `sha`, or None."""
    try:
        return json.loads(git(root, "show", f"{sha}:plugins/{name}/.claude-plugin/plugin.json"))
    except (subprocess.CalledProcessError, json.JSONDecodeError):
        return None


def is_ancestor(root: Path, older: str, newer: str) -> bool:
    return subprocess.run(["git", "-C", str(root), "merge-base", "--is-ancestor", older, newer],
                          capture_output=True).returncode == 0


def plugin_dirs(root: Path) -> list[str]:
    """Every plugin in the working tree: the set the latest channel serves."""
    base = root / "plugins"
    return sorted(d.name for d in base.iterdir() if (d / ".claude-plugin" / "plugin.json").is_file()) if base.is_dir() else []


def load_manifest(root: Path, name: str) -> dict:
    return json.loads((root / "plugins" / name / ".claude-plugin" / "plugin.json").read_text(encoding="utf-8"))


def stable_versions(root: Path, catalog: dict) -> dict[str, str]:
    """Plugin name → version the stable catalog serves (at the pin, or in the tree for a relative entry)."""
    versions = {}
    for entry in catalog.get("plugins", []):
        name = entry.get("name")
        manifest = manifest_at(root, entry["source"]["sha"], name) if is_pin(entry) else None
        if manifest is None and isinstance(entry.get("source"), str) and (root / entry["source"]).is_dir():
            manifest = json.loads((root / entry["source"] / ".claude-plugin" / "plugin.json").read_text(encoding="utf-8"))
        if manifest:
            versions[name] = str(manifest.get("version", ""))
    return versions


def latest_catalog(root: Path, stable: dict) -> dict:
    """The latest channel's marketplace.json: every plugin under `plugins/` by relative path."""
    plugins = []
    for name in plugin_dirs(root):
        manifest = load_manifest(root, name)
        plugins.append({
            "name": name,
            "source": f"./plugins/{name}",
            "description": manifest.get("description", ""),
            "category": (manifest.get("metadata") or {}).get("category", ""),
        })
    catalog = {key: stable[key] for key in ("$schema",) if key in stable}
    catalog.update({
        "name": LATEST_NAME,
        "description": f"{stable.get('description', '').rstrip('.')}. Latest channel: every plugin and version as soon as it is merged.",
        "owner": stable.get("owner"),
        "plugins": plugins,
    })
    if stable.get("renames"):
        catalog["renames"] = stable["renames"]
    return catalog
