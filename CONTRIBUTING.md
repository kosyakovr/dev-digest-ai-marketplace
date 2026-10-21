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
4. Add eval cases that show each new skill or agent is reachable by its namespaced name: in `plugins/<name>/evals/` for a plugin without dependencies, in the repository-level `evals/` (with `plugins:` listing every plugin the case needs) for one with dependencies. See [docs/RELEASES.md](docs/RELEASES.md#release-checklist).
5. Add at least one search query per new skill, agent or command to [site/tests/golden-queries.json](site/tests/golden-queries.json). CI fails until each one has a query. Check the result with `cd site && npm run dev`.

## Dependencies between plugins

- Declare them in the dependent's `plugin.json` **by name only**: `"dependencies": ["engineering-paved-path"]`. A name with no `version` resolves to the copy the user's own marketplace serves, so a dependency never comes from git tags or from another release channel ([docs/specs/release-channels.md](docs/specs/release-channels.md), R6).
- Put the range you tested against in `metadata.compat`, as `^X.Y.Z`: `"metadata": {"compat": {"engineering-paved-path": "^1.0.0"}}`. Claude Code does not read it; `check_marketplace.py` checks that every dependency has one, that the dependency is in the same catalog, and that its version satisfies the range (R7). A major version of a dependency therefore lands together with the dependents that accept it.
- Set `metadata.category` in `plugin.json` to the category of the plugin's marketplace entry (R9).
- Refer to another plugin's components by namespace only: `engineering-paved-path:zod`, `research-tools:researcher`. Never by path; another plugin's install directory is unknown.

## Writing skills and agents

- One skill per directory: `skills/<name>/SKILL.md`, where frontmatter `name` equals the directory name.
- The `description` decides when Claude loads the skill. Say what it does **and** when to use it, with trigger words first. Keep it under ~300 characters (hard limit 1024).
- Keep `SKILL.md` under ~500 lines; move detail into `references/` one level deep.
- Skills replace commands for new work. Use an agent only when the task needs its own context.
- Hook scripts: call them through their interpreter (`bash "${CLAUDE_PLUGIN_ROOT}/hooks/x.sh"`) and still mark them executable (`git update-index --chmod=+x`).
- Do not put a `CLAUDE.md` in a plugin; it is not loaded.
- No repository assumptions. An agent lists what it needs in an `## Inputs` table (required, default) and returns `NEEDS CLARIFICATION` when a required input is missing. Paths like `docs/specs/` are defaults, never facts.
- Plugin-level files are referenced as `"${CLAUDE_PLUGIN_ROOT}/…"`, scripts inside a skill as `"${CLAUDE_SKILL_DIR}/scripts/…"`, always called through their interpreter.
- Plugin agents ignore `hooks`, `permissionMode` and `mcpServers` in frontmatter; restrict them with `tools` / `disallowedTools` instead.
- One owner per instruction: an agent cites a skill rule (`engineering-paved-path:onion-architecture §4`) instead of restating it.
- Never put credentials in a manifest. A secret a plugin needs goes in `userConfig` with `sensitive: true`; `check_marketplace.py` fails token-shaped literals.

## Checks to run before pushing

```bash
python3 scripts/check_marketplace.py
python3 scripts/test_check_marketplace.py
python3 scripts/generate_catalog.py --check
claude plugin validate . --strict
for d in plugins/*/; do claude plugin validate "$d" --strict; done
bash plugins/sdd-engineering/scripts/test-spec-lint.sh
bash plugins/sdd-engineering/skills/sdd-run/scripts/save-report.sh --self-test
node --test plugins/sdd-engineering/skills/workflow-retro/scripts/retro.test.mjs
python3 scripts/check_version_bump.py origin/main
(cd site && npm test && npm run build)
```

## Releases

After a merge to `main`, the **Tag plugin releases** workflow runs `claude plugin tag` and pushes a `<plugin>--v<version>` tag for every version that is not tagged yet.
