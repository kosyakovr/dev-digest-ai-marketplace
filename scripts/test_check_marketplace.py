#!/usr/bin/env python3
"""Offline checks for check_marketplace.py and check_promotion.py (same directory).

Each case builds a small marketplace in a temporary git repository, runs the
checker on it with --root, and compares the exit code and the reported
errors. A check with no failing case is not a check, so every rule below has
a planted hit; each clean case must pass.

Usage: python3 scripts/test_check_marketplace.py
Exit code 0 = every case passed, 1 = at least one failed.
"""
from __future__ import annotations

import copy
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import channels  # noqa: E402

CHECKER, PROMOTION = HERE / "check_marketplace.py", HERE / "check_promotion.py"

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


def sh(root: Path, *args: str) -> str:
    return subprocess.run(args, cwd=root, capture_output=True, text=True, check=True).stdout.strip()


def commit(root: Path, message: str) -> str:
    sh(root, "git", "add", "-A")
    sh(root, "git", "-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-q", "--allow-empty", "-m", message)
    return sh(root, "git", "rev-parse", "HEAD")


def write_plugins(root: Path, plugins: dict) -> None:
    for name, manifest in plugins.items():
        plugin = root / "plugins" / name
        (plugin / ".claude-plugin").mkdir(parents=True, exist_ok=True)
        (plugin / ".claude-plugin" / "plugin.json").write_text(json.dumps(manifest))
        (plugin / "README.md").write_text(f"# {name}\n")
        (plugin / "LICENSE").write_text("MIT\n")
        (plugin / "CHANGELOG.md").write_text(f"# Changelog\n\n## [{manifest['version']}]\n")


def write_catalog(root: Path, catalog: dict) -> None:
    (root / ".claude-plugin").mkdir(exist_ok=True)
    (root / ".claude-plugin" / "marketplace.json").write_text(json.dumps(catalog, indent=2))


def pin(name: str, sha: str, description: str, **source) -> dict:
    return {"name": name, "description": description, "category": "development",
            "source": {"source": "git-subdir", "url": channels.REPO_URL, "path": f"plugins/{name}",
                       "ref": "main", "sha": sha, **source}}


def new_repo(tmp: str, spec: dict) -> tuple[Path, str]:
    """A repository whose `main` holds the plugins: returns the root and that commit."""
    root = Path(tmp)
    sh(root, "git", "init", "-q", "-b", "main")
    write_plugins(root, spec["plugins"])
    write_catalog(root, spec["marketplace"])
    return root, commit(root, "plugins")


def check(root: Path) -> tuple[int, list[str]]:
    proc = subprocess.run([sys.executable, str(CHECKER), "--root", str(root)], capture_output=True, text=True)
    return proc.returncode, sorted(l.removeprefix("::error::") for l in proc.stdout.splitlines() if l.startswith("::error::"))


def variant(edit) -> dict:
    spec = copy.deepcopy(BASE)
    edit(spec)
    return spec


def app(spec: dict) -> dict:
    return spec["plugins"]["app"]


# Relative-path catalog (the generated latest catalog): every plugin listed.
RELATIVE: list[tuple[str, dict, list[str]]] = [
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
     ["marketplace.json plugins[1]: category 'development' differs from plugin.json metadata.category None",
      "plugins/lib/.claude-plugin/plugin.json: metadata.category is missing"]),
    ("category-differs-from-entry",
     variant(lambda s: s["plugins"]["lib"]["metadata"].update(category="research")),
     ["marketplace.json plugins[1]: category 'development' differs from plugin.json metadata.category 'research'"]),
    ("pre-release-version",
     variant(lambda s: s["plugins"]["lib"].update(version="1.3.0-rc.1")),
     ["plugins/lib/.claude-plugin/plugin.json: version '1.3.0-rc.1' must be X.Y.Z, with no pre-release suffix"]),
    ("plugin-not-listed",
     variant(lambda s: s["marketplace"]["plugins"].pop(0)),
     ["plugins/app: directory is not listed in marketplace.json"]),
]


RUN = {"cases": 0}


def run_relative() -> list[str]:
    failures = []
    for name, spec, want in RELATIVE:
        RUN["cases"] += 1
        with tempfile.TemporaryDirectory() as tmp:
            root, _ = new_repo(tmp, spec)
            code, got = check(root)
        if code != (1 if want else 0) or got != sorted(want):
            failures.append(f"{name}: exit {code}\n  got:  {got}\n  want: {sorted(want)}")
    return failures


def run_pins() -> list[str]:
    """Stable catalog of pins, checked against plugin.json at each pinned commit (R1-R3, R7)."""
    failures = []

    def case(name: str, build, want) -> None:
        RUN["cases"] += 1
        with tempfile.TemporaryDirectory() as tmp:
            root, c1 = new_repo(tmp, BASE)
            expected = build(root, c1)
            code, got = check(root)
        expected = sorted(expected if expected is not None else want)
        if code != (1 if expected else 0) or got != expected:
            failures.append(f"pins/{name}: exit {code}\n  got:  {got}\n  want: {expected}")

    def stable(root: Path, entries: list[dict]) -> None:
        write_catalog(root, {"name": "fixture", "owner": {"name": "test"}, "plugins": entries})

    case("clean", lambda r, c: stable(r, [pin("app", c, "App."), pin("lib", c, "Lib.")]), [])
    case("latest-only-plugin-allowed", lambda r, c: stable(r, [pin("lib", c, "Lib.")]), [])
    case("dependency-missing-from-stable", lambda r, c: stable(r, [pin("app", c, "App.")]),
         ["fixture: plugins/app: dependency 'lib' is not in this catalog"])
    case("wrong-path", lambda r, c: stable(r, [pin("app", c, "App."), {**pin("lib", c, "Lib."), "source": {**pin("lib", c, "Lib.")["source"], "path": "lib"}}]),
         ["marketplace.json plugins[1]: source.path must be 'plugins/lib'",
          "fixture: plugins/app: dependency 'lib' is not in this catalog"])
    case("mixed-entries", lambda r, c: stable(r, [pin("app", c, "App."), BASE["marketplace"]["plugins"][1]]),
         ["marketplace.json: entries must be all pins (stable) or all relative paths (latest), not a mix"])

    def off_main(root: Path, c1: str) -> list[str]:
        sh(root, "git", "switch", "-q", "-c", "side")
        side = commit(root, "side commit")
        sh(root, "git", "switch", "-q", "main")
        stable(root, [pin("app", c1, "App."), pin("lib", side, "Lib.")])
        return [f"marketplace.json plugins[1]: sha {side[:12]} is not a commit on main",
                "fixture: plugins/app: dependency 'lib' is not in this catalog"]
    case("pin-not-on-main", off_main, None)

    def description_at_pin(root: Path, c1: str) -> list[str]:
        stable(root, [pin("app", c1, "App."), pin("lib", c1, "Other.")])
        return [f"marketplace.json plugins[1] (pinned at {c1[:12]}): description differs from plugin.json"]
    case("description-differs-at-pin", description_at_pin, None)

    def incompatible_at_pin(root: Path, c1: str) -> list[str]:
        # The tree is compatible (lib 1.2.0, app ^1.0.0) but the pinned app wants ^2.0.0.
        spec = variant(lambda s: app(s)["metadata"]["compat"].update(lib="^2.0.0"))
        write_plugins(root, {"app": spec["plugins"]["app"]})
        c2 = commit(root, "app wants lib 2")
        write_plugins(root, BASE["plugins"])
        commit(root, "back")
        stable(root, [pin("app", c2, "App."), pin("lib", c1, "Lib.")])
        return ["fixture: plugins/app: lib 1.2.0 is outside its range ^2.0.0 in metadata.compat"]
    case("incompatible-at-pin", incompatible_at_pin, None)

    def eval_without_plugin_tag(root: Path, c1: str) -> list[str]:
        stable(root, [pin("app", c1, "App."), pin("lib", c1, "Lib.")])
        (root / "evals" / "case").mkdir(parents=True)
        (root / "evals" / "case" / "prompt.md").write_text("---\ntags: [agents]\n---\nDo it.\n")
        return ["evals/case/prompt.md: tags ['agents'] name no plugin of this marketplace"]
    case("eval-without-plugin-tag", eval_without_plugin_tag, None)
    return failures


def run_promotions() -> list[str]:
    """check_promotion.py: one plugin per PR, forward only unless the title says rollback (R11)."""
    failures = []

    def case(name: str, change, title: str, want_code: int, want_text: str) -> None:
        RUN["cases"] += 1
        with tempfile.TemporaryDirectory() as tmp:
            root, c1 = new_repo(tmp, BASE)
            write_catalog(root, {"name": "fixture", "owner": {"name": "test"},
                                 "plugins": [pin("app", c1, "App."), pin("lib", c1, "Lib.")]})
            commit(root, "switch to pins")
            write_plugins(root, {"lib": {**BASE["plugins"]["lib"], "version": "1.3.0"}})
            c3 = commit(root, "lib 1.3.0")
            sh(root, "git", "switch", "-q", "-c", "pr")
            change(root, c1, c3)
            commit(root, "pr")
            proc = subprocess.run([sys.executable, str(PROMOTION), "main", "--root", str(root)],
                                  capture_output=True, text=True, env={**os.environ, "PR_TITLE": title})
        out = proc.stdout
        if proc.returncode != want_code or want_text not in out:
            failures.append(f"promotion/{name}: exit {proc.returncode} (want {want_code}), want text {want_text!r}\n{out}")

    def move(root: Path, entries: list[dict]) -> None:
        write_catalog(root, {"name": "fixture", "owner": {"name": "test"}, "plugins": entries})

    case("forward-one-plugin", lambda r, c1, c3: move(r, [pin("app", c1, "App."), pin("lib", c3, "Lib.")]),
         "Promote lib 1.3.0 to stable", 0, "lib: ")
    case("no-pin-change", lambda r, c1, c3: (r / "notes.txt").write_text("x"), "Docs", 0, "No pin changed")
    case("two-plugins", lambda r, c1, c3: move(r, [pin("app", c3, "App."), pin("lib", c3, "Lib.")]),
         "Promote", 1, "a promotion changes one plugin's pin")
    case("other-file-changed", lambda r, c1, c3: (move(r, [pin("app", c1, "App."), pin("lib", c3, "Lib.")]),
                                                   (r / "notes.txt").write_text("x")),
         "Promote lib", 1, "also changed: ['notes.txt']")

    def backwards(root: Path, c1: str, c3: str) -> None:
        # Base pins lib at c3 on main; the PR moves it back to c1.
        sh(root, "git", "switch", "-q", "main")
        move(root, [pin("app", c1, "App."), pin("lib", c3, "Lib.")])
        commit(root, "promote lib")
        sh(root, "git", "switch", "-q", "-C", "pr")
        move(root, [pin("app", c1, "App."), pin("lib", c1, "Lib.")])
    case("backwards-without-rollback", backwards, "Move lib", 1, "moving a pin back is a rollback")
    case("backwards-with-rollback", backwards, "Rollback lib to 1.2.0", 0, "(rollback)")
    case("removal-without-rollback", lambda r, c1, c3: move(r, [pin("app", c1, "App.")]),
         "Drop lib", 1, "removing a stable entry is a rollback")
    return failures


def main() -> int:
    groups = {"relative catalog": run_relative(), "stable pins": run_pins(), "promotions": run_promotions()}
    total_failed = 0
    for group, failures in groups.items():
        for failure in failures:
            print(f"FAIL {group}: {failure}")
        total_failed += len(failures)
    print(f"check_marketplace: {RUN['cases'] - total_failed} passed, {total_failed} failed")
    return 1 if total_failed else 0


if __name__ == "__main__":
    sys.exit(main())
