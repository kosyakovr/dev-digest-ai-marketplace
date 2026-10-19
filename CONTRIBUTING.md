# Contributing

## Rules that protect users

1. **Bump the version on every change.** Users only receive an update when `version` in `plugins/<name>/.claude-plugin/plugin.json` changes. CI fails a PR that changes a plugin without a bump (README-only changes are exempt).
2. **The version lives only in `plugin.json`.** Do not add `version` to `marketplace.json` entries; when both are set, `plugin.json` silently wins.
3. **Add a CHANGELOG entry** as `## [x.y.z]` for the new version.
4. **Never rename a plugin.** Its `name` is the install ID (`name@dev-digest-ai`). For a new label, set `displayName`. For a real rename or removal, add the old name to `renames` in `marketplace.json`.
5. **Keep everything inside the plugin directory.** Installed plugins are copied to a cache, so `../shared` paths break after install. Reference bundled files through `"${CLAUDE_PLUGIN_ROOT}"` (quoted) and store state in `${CLAUDE_PLUGIN_DATA}`.
6. **Disclose hooks, MCP servers and executables** in the PR description. They run outside the sandbox with the user's permissions. Undisclosed ones are grounds for closing the PR.

## Adding a plugin

1. Create `plugins/<kebab-name>/` with `.claude-plugin/plugin.json`, `README.md`, `CHANGELOG.md` and `LICENSE`. The directory name, `plugin.json` `name` and marketplace entry `name` must be identical.
2. Add the entry to `.claude-plugin/marketplace.json`, keeping `plugins` sorted alphabetically. Copy the `description` from `plugin.json` exactly.
3. Run `python3 scripts/generate_catalog.py` to update the README table.

## Writing skills and agents

- One skill per directory: `skills/<name>/SKILL.md`, where frontmatter `name` equals the directory name.
- The `description` decides when Claude loads the skill. Say what it does **and** when to use it, with trigger words first. Keep it under ~300 characters (hard limit 1024).
- Keep `SKILL.md` under ~500 lines; move detail into `references/` one level deep.
- Skills replace commands for new work. Use an agent only when the task needs its own context.
- Hook scripts: call them through their interpreter (`bash "${CLAUDE_PLUGIN_ROOT}/hooks/x.sh"`) and still mark them executable (`git update-index --chmod=+x`).
- Do not put a `CLAUDE.md` in a plugin; it is not loaded.

## Checks to run before pushing

```bash
python3 scripts/check_marketplace.py
python3 scripts/generate_catalog.py --check
claude plugin validate . --strict
for d in plugins/*/; do claude plugin validate "$d" --strict; done
python3 scripts/check_version_bump.py origin/main
```

## Releases

After a merge to `main`, the **Tag plugin releases** workflow runs `claude plugin tag` and pushes a `<plugin>--v<version>` tag for every version that is not tagged yet.
