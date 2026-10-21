#!/usr/bin/env python3
"""Repository policy checks for the marketplace.

Covers what `claude plugin validate` does not: source directories exist,
entry and manifest agree, required files are present, frontmatter is filled
in, dependencies are declared by name and resolve inside the same catalog
at a version their dependent's compatibility range accepts, manifests carry
no credentials, and no hidden Unicode or non-executable shell scripts slip in.

Release channels (docs/specs/release-channels.md): every directory under
plugins/ is checked, since the latest channel serves them all. A catalog of
pins is the stable channel: each pin is checked against plugin.json at its
commit on main, and compatibility is checked for both channels. A catalog of
relative paths (the generated latest catalog) must list every plugin.

Usage: python3 scripts/check_marketplace.py [--root <marketplace dir>]
Exit code 0 = all checks passed, 1 = at least one error.
Test: python3 scripts/test_check_marketplace.py (offline).
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import channels  # noqa: E402  (shared with the other release-channel scripts)

ROOT = (Path(sys.argv[sys.argv.index("--root") + 1]) if "--root" in sys.argv
        else Path(__file__).parent.parent).resolve()
MARKETPLACE = ROOT / ".claude-plugin" / "marketplace.json"
PLUGINS_DIR = ROOT / "plugins"

KEBAB = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
SEMVER = re.compile(r"^\d+\.\d+\.\d+$")  # no pre-releases: channels replace them (R10)
RESERVED_PREFIXES = ("claude-", "anthropic-", "anthropics-", "cc-plugin-")
RESERVED_NAMES = {"claude", "anthropic", "anthropics", "claude-code", "claude-mods"}
REQUIRED_PLUGIN_FILES = ("README.md", "CHANGELOG.md", "LICENSE")
JSON_COMPONENT_FILES = ("hooks/hooks.json", ".mcp.json", ".lsp.json")
# Bidi overrides and zero-width characters used to hide text from reviewers.
HIDDEN_UNICODE = re.compile("[​-‏‪-‮⁠-⁤⁦-⁩﻿]")
MAX_DESCRIPTION = 1024
# Credentials never belong in a manifest: token-shaped literals, and literal
# values under secret-sounding keys (a `${...}` placeholder is fine).
TOKEN_LITERAL = re.compile(r"(ghp_|gho_|github_pat_|sk-ant-|sk-[A-Za-z0-9]{16}|xox[abpr]-|AKIA[0-9A-Z]{12}|AIza[0-9A-Za-z_-]{20})")
SECRET_KEY = re.compile(r"(token|secret|password|passwd|api[_-]?key|private[_-]?key|credential)", re.I)
MANIFEST_FILES = (".claude-plugin/plugin.json", ".mcp.json", ".lsp.json", "hooks/hooks.json")

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


def find_secrets(value: object, path: str, where: str) -> None:
    """Walk a parsed manifest and report literal credentials."""
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{path}.{key}" if path else str(key)
            if (isinstance(child, str) and child and SECRET_KEY.search(str(key))
                    and not re.fullmatch(r"\$\{[^}]+\}", child.strip())):
                error(f"{where}: `{child_path}` holds a literal credential; use userConfig with sensitive: true")
            find_secrets(child, child_path, where)
    elif isinstance(value, list):
        for i, child in enumerate(value):
            find_secrets(child, f"{path}[{i}]", where)
    elif isinstance(value, str) and TOKEN_LITERAL.search(value):
        error(f"{where}: `{path}` contains a token-shaped literal")


def caret_allows(spec: str, version: str) -> bool | None:
    """True/False for a `^X.Y.Z` range and an `X.Y.Z` version, None for anything else."""
    m = re.fullmatch(r"\^(\d+)\.(\d+)\.(\d+)", spec.strip())
    v = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)", version)
    if not m or not v:
        return None
    lo, cur = tuple(map(int, m.groups())), tuple(map(int, v.groups()))
    if cur < lo:
        return False
    if lo[0] > 0:
        return cur[0] == lo[0]
    return cur[:2] == lo[:2] if lo[1] > 0 else cur == lo


def check_dependencies(catalog: str, manifests: dict[str, dict]) -> None:
    """Dependencies are bare names of plugins in the same catalog (so Claude
    Code resolves them inside the user's channel), and each one's version
    satisfies the `^X.Y.Z` range the dependent keeps in `metadata.compat`."""
    for name, manifest in manifests.items():
        where = f"{catalog}: plugins/{name}"
        deps = manifest.get("dependencies") or []
        compat = (manifest.get("metadata") or {}).get("compat") or {}
        if not isinstance(compat, dict):
            error(f"{where}: metadata.compat must be an object of dependency name to range")
            compat = {}
        names = []
        for dep in deps:
            if not isinstance(dep, str):
                error(f"{where}: dependency {dep!r} must be a bare plugin name; "
                      "put its range in metadata.compat")
                continue
            names.append(dep)
            if "@" in dep:
                error(f"{where}: dependency {dep!r} names another marketplace, which this marketplace does not use")
            elif dep == name:
                error(f"{where}: depends on itself")
            elif dep not in manifests:
                error(f"{where}: dependency {dep!r} is not in this catalog")
            spec = compat.get(dep)
            if spec is None:
                error(f"{where}: dependency {dep!r} has no range in metadata.compat")
                continue
            dep_version = str(manifests.get(dep, {}).get("version", ""))
            ok = caret_allows(str(spec), dep_version) if dep in manifests else None
            if not re.fullmatch(r"\^\d+\.\d+\.\d+", str(spec)):
                error(f"{where}: metadata.compat range {dep} {spec!r} must have the form ^X.Y.Z")
            elif ok is False:
                error(f"{where}: {dep} {dep_version} is outside its range {spec} in metadata.compat")
        for extra in sorted(set(compat) - set(names)):
            error(f"{where}: metadata.compat names {extra!r}, which is not in dependencies")


WORKTREE: dict[str, dict] = {}  # every plugin under plugins/, as checked in the tree


def check_plugin_dir(plugin_dir: Path) -> None:
    """Checks for every plugin in the tree, whether or not this catalog lists it."""
    manifest_path = plugin_dir / ".claude-plugin" / "plugin.json"
    if not manifest_path.is_file():
        error(f"{rel(plugin_dir)}: missing .claude-plugin/plugin.json")
        return
    manifest = load_json(manifest_path)
    if manifest is None:
        return
    name = plugin_dir.name
    check_name(name, rel(plugin_dir))
    if manifest.get("name") != name:
        error(f"{rel(manifest_path)}: name {manifest.get('name')!r} must equal its directory name {name!r}")
    version = manifest.get("version", "")
    if not SEMVER.match(str(version)):
        error(f"{rel(manifest_path)}: version {version!r} must be X.Y.Z, with no pre-release suffix")
    if not manifest.get("description"):
        error(f"{rel(manifest_path)}: missing `description`")
    if not (manifest.get("metadata") or {}).get("category"):
        error(f"{rel(manifest_path)}: metadata.category is missing")
    WORKTREE[name] = manifest
    for manifest_file in MANIFEST_FILES:
        mf = plugin_dir / manifest_file
        if mf.is_file():
            parsed = load_json(mf)
            if parsed is not None:
                find_secrets(parsed, "", rel(mf))

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


def check_entry(entry: dict, index: int) -> dict | None:
    """Check one catalog entry and return the plugin.json it serves: at the pinned
    commit for a pin (R1, R2), in the tree for a relative path."""
    where = f"marketplace.json plugins[{index}]"
    name = entry.get("name")
    if "version" in entry:
        error(f"{where}: set `version` only in plugin.json, not in the marketplace entry")
    if not entry.get("description"):
        error(f"{where}: missing `description`")
    if name not in WORKTREE:
        error(f"{where}: {name!r} has no plugin directory under plugins/")
        return None

    if channels.is_pin(entry):
        problems = channels.pin_problems(entry)
        for problem in problems:
            error(f"{where}: {problem}")
        if problems:
            return None
        sha = entry["source"]["sha"]
        main = channels.main_ref(ROOT)
        if not channels.is_ancestor(ROOT, sha, main):
            error(f"{where}: sha {sha[:12]} is not a commit on {main}")
            return None
        manifest = channels.manifest_at(ROOT, sha, name)
        if manifest is None:
            error(f"{where}: plugins/{name}/.claude-plugin/plugin.json does not exist at {sha[:12]}")
            return None
        where = f"{where} (pinned at {sha[:12]})"
    elif entry.get("source") == f"./plugins/{name}":
        manifest = WORKTREE[name]
    else:
        error(f"{where}: source must be './plugins/{name}' or a pin of this repository")
        return None

    if manifest.get("name") != name:
        error(f"{where}: plugin.json name {manifest.get('name')!r} differs from the entry")
    if manifest.get("description") != entry.get("description"):
        error(f"{where}: description differs from plugin.json")
    category = (manifest.get("metadata") or {}).get("category")
    if category != entry.get("category"):
        error(f"{where}: category {entry.get('category')!r} differs from plugin.json metadata.category {category!r}")
    return manifest


def check_eval_tags() -> None:
    """Repository-level eval cases carry the name of the plugin they test in `tags`, so a
    promotion runs only that plugin's cases: `claude plugin eval . --tag <plugin>` (R20)."""
    for prompt in sorted((ROOT / "evals").glob("*/prompt.md")):
        fm = parse_frontmatter(prompt) or {}
        tags = [t.strip().strip("\"'") for t in fm.get("tags", "").strip("[]").split(",") if t.strip()]
        if not set(tags) & set(WORKTREE):
            error(f"{rel(prompt)}: tags {tags} name no plugin of this marketplace")


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
    duplicates = sorted({n for n in names if names.count(n) > 1})
    if duplicates:
        error(f"marketplace.json: duplicate plugin names {duplicates}")
    if names != sorted(names):
        error("marketplace.json: plugins must be sorted alphabetically by name")

    if PLUGINS_DIR.is_dir():
        for plugin_dir in sorted(d for d in PLUGINS_DIR.iterdir() if d.is_dir()):
            check_plugin_dir(plugin_dir)

    pins = {channels.is_pin(entry) for entry in plugins}
    if len(pins) > 1:
        error("marketplace.json: entries must be all pins (stable) or all relative paths (latest), not a mix")
    served = {}
    for i, entry in enumerate(plugins):
        manifest = check_entry(entry, i)
        if manifest is not None:
            served[entry["name"]] = manifest
    check_dependencies(str(marketplace.get("name")), served)

    if True in pins:
        # Stable may leave plugins out (R3); latest is generated from the whole tree, so check that set too (R7).
        check_dependencies(channels.LATEST_NAME, WORKTREE)
    else:
        for orphan in sorted(set(WORKTREE) - set(names)):
            error(f"plugins/{orphan}: directory is not listed in marketplace.json")
    check_eval_tags()
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
