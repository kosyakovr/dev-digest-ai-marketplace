## What changes

<!-- Which plugin(s), and what users will notice. -->

## Checklist

- [ ] Bumped `version` in `plugins/<name>/.claude-plugin/plugin.json` (not in `marketplace.json`)
- [ ] Added a `## [x.y.z]` section to the plugin's `CHANGELOG.md`
- [ ] Ran `python3 scripts/check_marketplace.py` and `claude plugin validate . --strict`
- [ ] Regenerated the README catalog if names, descriptions or versions changed (`python3 scripts/generate_catalog.py`)
- [ ] Added a golden search query for each new skill, agent or command (`site/tests/golden-queries.json`)
- [ ] Disclosed every new or changed hook, MCP server and `bin/` executable below

## Hooks / MCP servers / executables

<!-- List them with what they run and why, or write "none". -->
