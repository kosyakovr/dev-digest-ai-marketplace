#!/usr/bin/env python3
"""Repository policy checks for the marketplace.

Covers what `claude plugin validate` does not: source directories exist,
entry and manifest agree, required files are present, frontmatter is filled
in, and no hidden Unicode or non-executable shell scripts slip in.

Usage: python3 scripts/check_marketplace.py
Exit code 0 = all checks passed, 1 = at least one error.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MARKETPLACE = ROOT / ".claude-plugin" / "marketplace.json"
PLUGINS_DIR = ROOT / "plugins"

KEBAB = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
SEMVER = re.compile(r"^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$")
RESERVED_PREFIXES = ("claude-", "anthropic-", "anthropics-", "cc-plugin-")
RESERVED_NAMES = {"claude", "anthropic", "anthropics", "claude-code", "claude-mods"}
REQUIRED_PLUGIN_FILES = ("README.md", "CHANGELOG.md", "LICENSE")
JSON_COMPONENT_FILES = ("hooks/hooks.json", ".mcp.json", ".lsp.json")
# Bidi overrides and zero-width characters used to hide text from reviewers.
HIDDEN_UNICODE = re.compile("[​-‏‪-‮⁠-⁤⁦-⁩﻿]")
MAX_DESCRIPTION = 1024

errors: list[str] = []


def error(msg: str) -> None:
    errors.append(msg)


def rel(path: Path) -> str:
    return str(path.relative_to(ROOT))


def load_json(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        error(f"{rel(path)}: cannot parse JSON ({exc})")
        return None


def parse_frontmatter(path: Path) -> dict[str, str] | None:
    """Minimal YAML frontmatter reader: top-level `key: value` pairs only."""
    lines = path.read_text(encoding="utf-8").splitlines()
    if not lines or lines[0].strip() != "---":
        return None
    fields: dict[str, str] = {}
    key = None
    for line in lines[1:]:
        if line.strip() == "---":
            return fields
        match = re.match(r"^([A-Za-z0-9_-]+):\s*(.*)$", line)
        if match:
            key, value = match.groups()
            fields[key] = value.strip().strip("\"'")
        elif key and line.startswith((" ", "\t")):
            fields[key] = (fields[key] + " " + line.strip()).strip()
    return None  # no closing ---


def check_name(name: object, where: str) -> None:
    if not isinstance(name, str) or not KEBAB.match(name):
        error(f"{where}: name {name!r} must be kebab-case")
        return
    if name in RESERVED_NAMES or name.startswith(RESERVED_PREFIXES):
        error(f"{where}: name {name!r} is reserved")


def check_component(path: Path, kind: str, expected_name: str | None) -> None:
    fm = parse_frontmatter(path)
    if fm is None:
        error(f"{rel(path)}: missing or unterminated YAML frontmatter")
        return
    name = fm.get("name", "")
    description = fm.get("description", "")
    if not name:
        error(f"{rel(path)}: frontmatter has no `name`")
    elif expected_name and name != expected_name:
        error(f"{rel(path)}: {kind} name {name!r} must match {expected_name!r}")
    if not description:
        error(f"{rel(path)}: frontmatter has no `description`")
    elif len(description) > MAX_DESCRIPTION:
        error(f"{rel(path)}: description is {len(description)} chars (max {MAX_DESCRIPTION})")


def executable_in_git(paths: list[Path]) -> set[str]:
    """Return repo-relative paths whose git index mode is 100755."""
    if not paths:
        return set()
    try:
        out = subprocess.run(
            ["git", "ls-files", "-s", "--", *map(rel, paths)],
            cwd=ROOT, capture_output=True, text=True, check=True,
        ).stdout
    except (OSError, subprocess.CalledProcessError):
        return {rel(p) for p in paths}  # git unavailable: skip the check
    return {line.split("\t", 1)[1] for line in out.splitlines() if line.startswith("100755")}


def check_plugin(entry: dict, index: int) -> None:
    where = f"marketplace.json plugins[{index}]"
    name = entry.get("name")
    source = entry.get("source")

    if "version" in entry:
        error(f"{where}: set `version` only in plugin.json, not in the marketplace entry")
    if not entry.get("description"):
        error(f"{where}: missing `description`")

    if not isinstance(source, str):
        return  # external sources are validated by `claude plugin validate`
    if not source.startswith("./") or ".." in Path(source).parts or "\\" in source:
        error(f"{where}: source {source!r} must start with './' and must not contain '..' or '\\'")
        return
    plugin_dir = (ROOT / source).resolve()
    if not plugin_dir.is_dir():
        error(f"{where}: source directory {source!r} does not exist")
        return

    manifest_path = plugin_dir / ".claude-plugin" / "plugin.json"
    if not manifest_path.is_file():
        error(f"{rel(plugin_dir)}: missing .claude-plugin/plugin.json")
        return
    manifest = load_json(manifest_path)
    if manifest is None:
        return

    if manifest.get("name") != name:
        error(f"{rel(manifest_path)}: name {manifest.get('name')!r} != marketplace entry {name!r}")
    if plugin_dir.name != name:
        error(f"{rel(plugin_dir)}: directory name must equal plugin name {name!r}")
    version = manifest.get("version", "")
    if not SEMVER.match(str(version)):
        error(f"{rel(manifest_path)}: version {version!r} is not semver (X.Y.Z)")
    if manifest.get("description") != entry.get("description"):
        error(f"{rel(manifest_path)}: description differs from the marketplace entry")

    for required in REQUIRED_PLUGIN_FILES:
        if not (plugin_dir / required).is_file():
            error(f"{rel(plugin_dir)}: missing {required}")
    changelog = plugin_dir / "CHANGELOG.md"
    if changelog.is_file() and f"## [{version}]" not in changelog.read_text(encoding="utf-8"):
        error(f"{rel(changelog)}: no '## [{version}]' section for the current version")
    if (plugin_dir / "CLAUDE.md").exists():
        error(f"{rel(plugin_dir)}: CLAUDE.md is not loaded from plugins; move it into a skill")

    extra = [p.name for p in (plugin_dir / ".claude-plugin").iterdir() if p.name != "plugin.json"]
    if extra:
        error(f"{rel(plugin_dir)}/.claude-plugin: only plugin.json belongs here, found {extra}")

    for json_file in JSON_COMPONENT_FILES:
        if (plugin_dir / json_file).is_file():
            load_json(plugin_dir / json_file)

    for skill_md in sorted(plugin_dir.glob("skills/*/SKILL.md")):
        check_component(skill_md, "skill", skill_md.parent.name)
    for skill_dir in sorted(p for p in plugin_dir.glob("skills/*") if p.is_dir()):
        if not (skill_dir / "SKILL.md").is_file():
            error(f"{rel(skill_dir)}: skill directory has no SKILL.md")
    for md in sorted(plugin_dir.glob("agents/*.md")):
        check_component(md, "agent", md.stem)
    for md in sorted(plugin_dir.glob("commands/*.md")):
        check_component(md, "command", None)

    scripts = sorted(plugin_dir.rglob("*.sh"))
    executable = executable_in_git(scripts)
    for script in scripts:
        if rel(script) not in executable:
            error(f"{rel(script)}: not executable in git (run: git update-index --chmod=+x {rel(script)})")

    for path in sorted(plugin_dir.rglob("*")):
        if path.is_file() and path.suffix in {".md", ".json", ".sh", ".py", ".js", ".ts", ".yml", ".yaml"}:
            if HIDDEN_UNICODE.search(path.read_text(encoding="utf-8", errors="replace")):
                error(f"{rel(path)}: contains hidden/bidirectional Unicode characters")


def main() -> int:
    marketplace = load_json(MARKETPLACE)
    if marketplace is None:
        return report()

    check_name(marketplace.get("name"), "marketplace.json")
    if not (marketplace.get("owner") or {}).get("name"):
        error("marketplace.json: `owner.name` is required")
    plugins = marketplace.get("plugins")
    if not isinstance(plugins, list) or not plugins:
        error("marketplace.json: `plugins` must be a non-empty array")
        return report()

    names = [p.get("name") for p in plugins]
    for i, name in enumerate(names):
        check_name(name, f"marketplace.json plugins[{i}]")
    duplicates = sorted({n for n in names if names.count(n) > 1})
    if duplicates:
        error(f"marketplace.json: duplicate plugin names {duplicates}")
    if names != sorted(names):
        error("marketplace.json: plugins must be sorted alphabetically by name")

    for i, entry in enumerate(plugins):
        check_plugin(entry, i)

    listed = {Path(p["source"]).name for p in plugins if isinstance(p.get("source"), str)}
    if PLUGINS_DIR.is_dir():
        for orphan in sorted(d.name for d in PLUGINS_DIR.iterdir() if d.is_dir() and d.name not in listed):
            error(f"plugins/{orphan}: directory is not listed in marketplace.json")

    return report()


def report() -> int:
    if errors:
        for msg in errors:
            print(f"::error::{msg}")
        print(f"\n{len(errors)} error(s)")
        return 1
    print("Marketplace policy checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
