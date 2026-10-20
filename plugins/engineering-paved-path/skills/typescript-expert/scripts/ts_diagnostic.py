#!/usr/bin/env python3
"""
TypeScript Project Diagnostic Script
Analyzes TypeScript projects for configuration, performance, and common issues.

Read-only by design:
- uses only a TypeScript compiler installed in the project's node_modules
  (never `npx`, so nothing is downloaded);
- runs `tsc` with --noEmit --incremental false --composite false, so no build
  output or .tsbuildinfo file is written;
- never calls a shell and never touches the network.

Usage (from the project root):
    python3 ts_diagnostic.py [--src DIR]
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
from pathlib import Path

SKIP_DIRS = {"node_modules", ".git", "dist", "build", ".next", "coverage", "out"}
TSC_SAFE_FLAGS = ["--noEmit", "--incremental", "false", "--composite", "false", "--pretty", "false"]


def run_cmd(args: list[str]) -> str:
    """Run a command without a shell and return its combined output."""
    try:
        result = subprocess.run(args, capture_output=True, text=True, timeout=300)
        return result.stdout + result.stderr
    except Exception as e:  # noqa: BLE001 - report any failure as text
        return str(e)


def find_local_tsc() -> Path | None:
    """Find node_modules/typescript/bin/tsc in the current directory or a parent."""
    for directory in [Path.cwd(), *Path.cwd().parents]:
        candidate = directory / "node_modules" / "typescript" / "bin" / "tsc"
        if candidate.is_file():
            return candidate
    return None


def tsc_args(tsc: Path, *extra: str) -> list[str]:
    return ["node", str(tsc), *TSC_SAFE_FLAGS, *extra]


def check_versions(tsc: Path | None):
    """Check TypeScript and Node versions."""
    print("\n📦 Versions:")
    print("-" * 40)

    ts_version = run_cmd(["node", str(tsc), "--version"]).strip() if tsc else ""
    node_version = run_cmd(["node", "-v"]).strip() if shutil.which("node") else ""

    print(f"  TypeScript: {ts_version or 'Not found in node_modules'}")
    print(f"  Node.js: {node_version or 'Not found'}")


def check_tsconfig():
    """Analyze tsconfig.json settings."""
    print("\n⚙️ TSConfig Analysis:")
    print("-" * 40)

    tsconfig_path = Path("tsconfig.json")
    if not tsconfig_path.exists():
        print("⚠️ tsconfig.json not found")
        return

    try:
        with open(tsconfig_path) as f:
            config = json.load(f)

        compiler_opts = config.get("compilerOptions", {})

        # Check strict mode
        if compiler_opts.get("strict"):
            print("✅ Strict mode enabled")
        else:
            print("⚠️ Strict mode NOT enabled")

        # Check important flags
        flags = {
            "noUncheckedIndexedAccess": "Unchecked index access protection",
            "noImplicitOverride": "Implicit override protection",
            "skipLibCheck": "Skip lib check (performance)",
            "incremental": "Incremental compilation"
        }

        for flag, desc in flags.items():
            status = "✅" if compiler_opts.get(flag) else "⚪"
            print(f"  {status} {desc}: {compiler_opts.get(flag, 'not set')}")

        # Check module settings
        print(f"\n  Module: {compiler_opts.get('module', 'not set')}")
        print(f"  Module Resolution: {compiler_opts.get('moduleResolution', 'not set')}")
        print(f"  Target: {compiler_opts.get('target', 'not set')}")

    except json.JSONDecodeError:
        print("❌ Could not parse tsconfig.json as plain JSON (comments or trailing commas?)")


def check_tooling():
    """Detect TypeScript tooling ecosystem."""
    print("\n🛠️ Tooling Detection:")
    print("-" * 40)

    pkg_path = Path("package.json")
    if not pkg_path.exists():
        print("⚠️ package.json not found")
        return

    try:
        with open(pkg_path) as f:
            pkg = json.load(f)

        all_deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}

        tools = {
            "biome": "Biome (linter/formatter)",
            "eslint": "ESLint",
            "prettier": "Prettier",
            "vitest": "Vitest (testing)",
            "jest": "Jest (testing)",
            "turborepo": "Turborepo (monorepo)",
            "turbo": "Turbo (monorepo)",
            "nx": "Nx (monorepo)",
            "lerna": "Lerna (monorepo)"
        }

        for tool, desc in tools.items():
            for dep in all_deps:
                if tool in dep.lower():
                    print(f"  ✅ {desc}")
                    break

    except json.JSONDecodeError:
        print("❌ Invalid JSON in package.json")


def check_monorepo():
    """Check for monorepo configuration."""
    print("\n📦 Monorepo Check:")
    print("-" * 40)

    indicators = [
        ("pnpm-workspace.yaml", "PNPM Workspace"),
        ("lerna.json", "Lerna"),
        ("nx.json", "Nx"),
        ("turbo.json", "Turborepo")
    ]

    found = False
    for file, name in indicators:
        if Path(file).exists():
            print(f"  ✅ {name} detected")
            found = True

    if not found:
        print("  ⚪ No monorepo configuration detected")


def iter_ts_lines(src: Path):
    """Yield (path, line number, line) for every .ts/.tsx file under src."""
    for root, dirs, files in os.walk(src):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in files:
            if name.endswith((".ts", ".tsx")) and not name.endswith(".d.ts"):
                path = Path(root) / name
                try:
                    with open(path, encoding="utf-8", errors="replace") as f:
                        for number, line in enumerate(f, 1):
                            yield path, number, line.rstrip("\n")
                except OSError:
                    continue


def check_type_errors(tsc: Path | None):
    """Run quick type check."""
    print("\n🔍 Type Check:")
    print("-" * 40)

    if not tsc:
        print("  ⚪ Skipped: no local TypeScript in node_modules")
        return

    result = run_cmd(tsc_args(tsc))
    if "error TS" in result:
        errors = result.count("error TS")
        print(f"  ❌ {errors} type errors found")
        print("\n".join(result.splitlines()[:20])[:500])
    else:
        print("  ✅ No type errors")


def check_any_usage(src: Path):
    """Check for any type usage."""
    print("\n⚠️ 'any' Type Usage:")
    print("-" * 40)

    hits = [(p, n, l) for p, n, l in iter_ts_lines(src) if ": any" in l]
    if hits:
        print(f"  ⚠️ Found {len(hits)} occurrences of ': any'")
        for path, number, line in hits[:5]:
            print(f"  {path}:{number}: {line.strip()}")
    else:
        print("  ✅ No explicit 'any' types found")


def check_type_assertions(src: Path):
    """Check for type assertions."""
    print("\n⚠️ Type Assertions (as):")
    print("-" * 40)

    count = sum(1 for _, _, l in iter_ts_lines(src) if " as " in l and "import" not in l)
    if count:
        print(f"  ⚠️ Found {count} type assertions")
    else:
        print("  ✅ No type assertions found")


def check_performance(tsc: Path | None):
    """Check type checking performance."""
    print("\n⏱️ Type Check Performance:")
    print("-" * 40)

    if not tsc:
        print("  ⚪ Skipped: no local TypeScript in node_modules")
        return

    result = run_cmd(tsc_args(tsc, "--extendedDiagnostics"))
    lines = [l for l in result.splitlines() if re.search(r"Check time|Files:|Lines:|Nodes:", l)]
    if lines:
        for line in lines:
            print(f"  {line}")
    else:
        print("  ⚠️ Could not measure performance")


def main():
    parser = argparse.ArgumentParser(description="Read-only TypeScript project diagnostic.")
    parser.add_argument("--src", default=None,
                        help="source directory to scan for 'any' and 'as' (default: src if present, else .)")
    args = parser.parse_args()
    src = Path(args.src) if args.src else (Path("src") if Path("src").is_dir() else Path("."))

    tsc = find_local_tsc()

    print("=" * 50)
    print("🔍 TypeScript Project Diagnostic Report")
    print("=" * 50)

    check_versions(tsc)
    check_tsconfig()
    check_tooling()
    check_monorepo()
    check_any_usage(src)
    check_type_assertions(src)
    check_type_errors(tsc)
    check_performance(tsc)

    print("\n" + "=" * 50)
    print("✅ Diagnostic Complete")
    print("=" * 50)


if __name__ == "__main__":
    main()
