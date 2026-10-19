# Spec: Marketplace catalog site

- **Status:** in review (scope approved)
- **Owner:** Ruslan Kosiakov
- **Last updated:** 2026-10-19
- **Implementation:** [site/](../../site/) (React + Vite), deployed to <https://kosyakovr.github.io/dev-digest-ai-marketplace/>. It replaces the earlier HTML prototype.

## Problem

Today the only way to discover what the `dev-digest-ai` marketplace offers is to read `marketplace.json` and plugin READMEs on GitHub. That has three gaps:

1. **No search across artifacts.** A user who needs "a skill for reviewing pull requests" has to open every plugin and read every `SKILL.md`. Skills and agents are not discoverable on their own, only through the plugin that contains them.
2. **No way to judge a plugin before installing it.** Hooks, MCP servers and executables run outside the sandbox with the user's permissions, but nothing summarises which plugins contain them.
3. **Team setup is manual.** Adding the marketplace to a team repository means hand-writing `.claude/settings.json` from documentation.

## Goals

- A user types a free-text query and finds the right artifact in the top 3 results for every query in the golden query set (R12).
- A user can copy an install command, or a ready `.claude/settings.json` for several plugins, without reading Claude Code docs.
- The catalog always reflects `main`: no hand-maintained catalog data, and the site is rebuilt on every merge.
- Every plugin page states plainly whether the plugin runs hooks, MCP servers, LSP servers or bundled executables.

## Non-goals

- **No backend.** No accounts, ratings, reviews, install counters or server-side search. The site is static and hosted on GitHub Pages.
- **No semantic or embedding-based search** in this version. Keyword search with aliases must meet the quality bar first.
- **No localisation.** The site, the content and search are English only.
- **No editing or publishing** of plugins from the site. Changes go through pull requests.
- **No indexing of other marketplaces.** Only this repository's marketplace is shown.
- **No analytics or third-party trackers.**

## Definitions

- **Artifact:** anything a user can find in the catalog. Types: `plugin`, `skill`, `agent`, `command`, `hook`, `mcp-server`, `lsp-server`.
- **Artifact ID:** `<plugin>` for a plugin, `<plugin>/<type>/<name>` for everything else (for example `review-pack/skill/code-review`). Stable as long as the names do not change.
- **Hosted plugin:** a marketplace entry whose `source` is a relative path inside this repository.

## Requirements

Phase `MVP` ships first. Phase `2` is planned but not required for the first release.

### Catalog data

| ID | Phase | Requirement | Acceptance criteria |
|---|---|---|---|
| R1 | MVP | The catalog is generated from the repository at build time. No catalog data is maintained by hand. | Adding a skill to a hosted plugin and merging to `main` makes it appear on the site with no other change. |
| R2 | MVP | The catalog contains every marketplace entry, and for each hosted plugin every skill, agent, command, hook event, MCP server and LSP server it declares, from both default locations and paths set in `plugin.json`. | A CI test compares artifact counts per type against a direct scan of the repository and fails on any difference. |
| R3 | MVP | Entries with external sources appear as plugin artifacts with the metadata from their marketplace entry only, marked "external". | An external entry shows name, description, category and install command, with an "external source" label, and has no component list. |
| R4 | MVP | Each artifact record holds: ID, type, name, description, parent plugin, plugin version, category, repository path, and searchable body text (the Markdown body for skills, agents and commands). | The generated catalog validates against a JSON schema stored in the repository. |
| R5 | MVP | Maintainers can attach site-only data to a plugin and its components (aliases now, example prompts in phase 2) without changing `SKILL.md` or agent files. | Adding an alias for `review-pack/skill/code-review` in the plugin's site data changes search results, and `claude plugin validate --strict` still passes. |
| R6 | MVP | The build fails if any hosted artifact cannot be parsed or lacks a name or description. | A PR with a `SKILL.md` that has no frontmatter fails CI with a message naming the file. |

### Search

| ID | Phase | Requirement | Acceptance criteria |
|---|---|---|---|
| R7 | MVP | The home page has a single search box. Results update as the user types. | With 1,000 synthetic artifacts, results render within 100 ms of the last keystroke on a mid-range laptop. |
| R8 | MVP | Natural-language queries work. Filler words are ignored, and type words (`skill`, `agent`, `plugin`, `command`, `hook`, `mcp`) narrow results to that type. | "I need a skill for reviewing pull requests" returns only skills, with `code-review` first. |
| R9 | MVP | Search tolerates typos and matches word prefixes. | "reveiw" finds `code-review`; "spec" finds `write-spec`, `spec-to-plan` and `spec-reviewer`. |
| R10 | MVP | Ranking favours matches in name, then aliases and description, then body text. | For "review", artifacts named `*review*` rank above artifacts that mention "review" only in their body. |
| R11 | MVP | Results can be filtered by type, plugin and category, combined with the query. Each filter value shows its result count. | Selecting type `agent` and plugin `sdd-engineering` with an empty query shows exactly `spec-reviewer`. |
| R12 | MVP | A golden query set (query → expected artifact IDs in the top 3) lives in the repository and runs in CI. | CI fails when any golden query misses its expected artifact. The initial set has at least one query per hosted artifact. |
| R13 | MVP | The query and filters are reflected in the URL. | Opening a copied URL restores the same query, filters and results. |
| R14 | MVP | An empty result explains what was searched and offers to clear filters or browse all artifacts. | A nonsense query shows the empty state with both actions working. |

### Result cards

| ID | Phase | Requirement | Acceptance criteria |
|---|---|---|---|
| R15 | MVP | Each result is a card with: type badge, name, parent plugin, description with matched terms highlighted, plugin version, security badges (R22), and a copy-install-command button. | The card for `code-review` shows type "skill", plugin "review-pack", and copies `claude plugin install review-pack@dev-digest-ai`. |
| R16 | MVP | Clicking a card opens the artifact's page. Keyboard users can reach and open every card. | Tab moves through cards; Enter opens the focused card. |

### Artifact pages

| ID | Phase | Requirement | Acceptance criteria |
|---|---|---|---|
| R17 | MVP | Each plugin has a page with: rendered README, version, category, component list linking to component pages, security section (R22), changelog, and install commands for user scope and project scope. | The `review-pack` page lists `code-review` and `code-reviewer`, and both links resolve. |
| R18 | MVP | Each skill, agent and command has a page with: description, rendered body, parent plugin link, the parent's install command, and how to invoke it (for example `/review-pack:code-review`). | The `write-spec` page shows `/sdd-engineering:write-spec`. |
| R19 | MVP | Every page URL loads when opened directly or shared, and has its own title and description. Without JavaScript the page says so and links to the repository. | Opening each plugin, skill, agent and command URL on GitHub Pages returns HTTP 200 with that page's `<title>`; an unknown URL shows the "Page not found" page. |
| R20 | MVP | Links inside rendered Markdown work: relative links to other files in the plugin open them on GitHub, or on the site when the target has a page. | A link checker over the built site reports no broken internal links. |

### Install builder

| ID | Phase | Requirement | Acceptance criteria |
|---|---|---|---|
| R21 | MVP | Users can add plugins to a selection from cards and plugin pages. The builder shows: (a) the `marketplace add` and `install` commands, and (b) a `.claude/settings.json` with `extraKnownMarketplaces` and `enabledPlugins` for the selection. Both have copy buttons; the settings file can also be downloaded. The selection persists across pages in the same browser. | Selecting both plugins produces settings JSON that parses, enables both plugins, and matches what `claude plugin marketplace add kosyakovr/dev-digest-ai-marketplace --scope project` plus the two installs write. Verified by a test. |

### Security transparency

| ID | Phase | Requirement | Acceptance criteria |
|---|---|---|---|
| R22 | MVP | Every plugin card and page shows a badge for each of: hooks, MCP servers, LSP servers, bundled executables (`bin/`). The plugin page lists each one with what it runs (hook event plus command; MCP server name plus command or URL). A plugin with none of them states "No hooks, MCP servers or executables". | A fixture plugin with one hook and one MCP server shows both badges, and its page lists the hook command and the MCP server command. |

### Phase 2

| ID | Phase | Requirement | Acceptance criteria |
|---|---|---|---|
| R23 | 2 | Each plugin shows an estimated always-on context cost: the characters and approximate tokens of the skill and agent descriptions it adds to every session. | The figure equals the sum of description lengths computed by a CI test, with the token estimate method documented on the page. |
| R24 | 2 | A "What's new" page lists plugin releases from git tags and CHANGELOG entries, newest first, and is published as an Atom feed. | After a version bump is merged and tagged, the release appears on the page and in the feed. |
| R25 | 2 | The catalog is published as `catalog.json` (with a schema version) and summarised in `llms.txt` at stable URLs, so other tools and agents can consume it. | Both files are reachable under the site root and `catalog.json` validates against the published schema. |
| R26 | 2 | Skills can show 2–3 example prompts that trigger them, each with a copy button, taken from the plugin's site data (R5). | `code-review` shows its example prompts; a skill without prompts shows no empty section. |
| R27 | 2 | A "Propose a plugin" link opens a pre-filled GitHub issue from an issue template. | The link opens the new-issue form with the template's fields filled in. |
| R28 | 2 | A scaffold generator turns a short form (plugin name, description, components) into a downloadable zip with a plugin skeleton that passes this repository's CI checks. | A generated plugin copied into `plugins/` passes `scripts/check_marketplace.py` and `claude plugin validate --strict` once its marketplace entry is added. |

### Quality

| ID | Phase | Requirement | Acceptance criteria |
|---|---|---|---|
| R29 | MVP | The site meets WCAG 2.1 AA. | Lighthouse accessibility score ≥ 95 on the home, plugin and skill pages; search and the install builder work by keyboard alone. |
| R30 | MVP | The site is fast on first load. | Lighthouse performance ≥ 90 on the home page. The JavaScript bundle stays under 150 KB gzipped (about 100 KB at launch). The search index is built on first use, not at page load. |
| R31 | MVP | Layouts work from 360 px wide upwards with no horizontal scrolling. | Visual check at 360, 768 and 1280 px on home, plugin and skill pages. |
| R32 | MVP | The site follows the system light or dark preference. | Both themes pass the same contrast checks as R29. |
| R33 | MVP | Every PR builds the site and runs the checks from R2, R12 and R20 without deploying. A merge to `main` builds and deploys through a GitHub Actions workflow. | A PR that breaks the build or a golden query cannot be merged, because the existing required `Validate` check fails. A merge that only changes a plugin still redeploys the site. |
| R34 | MVP | Developers run the site locally with one command. The local site uses the same base path as production and reloads when plugin files change. | `npm run dev` in `site/` serves the catalog at `http://localhost:5173/dev-digest-ai-marketplace/`; editing a skill's description shows the change after the automatic reload. |
| R35 | MVP | The site shows only plugins and components that the marketplace actually contains. No sample, placeholder or hand-written catalog entries ship to users. | The built catalog lists exactly the entries of `.claude-plugin/marketplace.json`; test fixtures live under `site/tests/` and are never read by the build. |

## Key screens

The site implements every MVP screen with the marketplace's real data. States that today's plugins do not have yet (hooks, MCP servers, executables, external entries) appear automatically when a plugin adds them; they are covered by tests with a fixture marketplace instead of sample data (R35).

| ID | Screen | URL | Contents | States to implement | Requirements |
|---|---|---|---|---|---|
| S1 | Catalog and search | `/` | Header (brand, Catalog, Install list with count, GitHub). Hero: title, one-line explanation, search box with `/` shortcut, example queries, "Add the marketplace once" command. Facet rail (Type, Plugin, Category with counts; a collapsible "Filters" panel below 861 px). Result summary and card grid. | Browse all (empty query, all artifacts sorted by type then name). Results for a query. Type words in the query narrow results, shown in a notice with "Show all types". Filters applied, with "Clear filters". | R7–R16 |
| S2 | No results | `/?q=…` | Empty state naming the query and how many artifacts were searched, with "Clear filters" (when filters are active) and "Browse all artifacts". | With and without active filters. | R14 |
| S3 | Plugin page | `/plugins/<plugin>/` | Breadcrumb, type badge, name, description, version, category, security badges. Sections: Components (type, name, description, link), What runs on your machine, README, Changelog, View source on GitHub. Sticky install panel: "Just me" / "Team repository" toggle, commands, add to install list. | Hosted plugin without hooks or servers (green "No hooks, MCP servers or executables" statement). Hosted plugin with hooks, MCP servers or executables (each listed with its command). External entry (Source section instead of Components; warning that its files cannot be inspected). | R17, R19, R20, R22 |
| S4 | Skill or command page | `/plugins/<plugin>/skills/<name>/` | Breadcrumb, type badge, name, description. How to use it: the slash command (`/plugin:skill`) plus plain-words hint. Details: plugin and version, source file, bundled files with GitHub links. Instructions Claude follows (rendered body). The parent plugin's install panel. | Skill with and without bundled files. | R18–R20 |
| S5 | Agent page | `/plugins/<plugin>/agents/<name>/` | As S4, with an "ask for it by name" example instead of a slash command, and a Tools row from frontmatter. | Agent with and without `tools`. | R18–R20 |
| S6 | Install list | `/install/` | Checklist of all plugins (description, version, security badges). Output: "Just me" / "Team repository" toggle. Just me: one command block. Team repository: step 1 commands with `--scope project`, step 2 `.claude/settings.json` with Copy JSON and Download, step 3 what teammates see (with the extra install step for external plugins). | Empty list (call to browse the catalog). One or more plugins, in both scopes. | R21 |

Hooks and MCP servers have no page of their own. Their cards open the parent plugin page at the "What runs on your machine" section.

### Shared components

- **Card:** type badge, External tag, plugin version, name (the whole card is the link), parent plugin link or component summary ("2 skills · 1 agent"), description with matched terms highlighted, security badges, "Copy install" and "Add to list" buttons.
- **Command block:** monospaced text with a Copy button. When the clipboard is refused, the text is selected and a message says how to copy it.
- **Security badges:** "Hooks · n", "MCP server · n", "LSP server · n", "Executables · n", shown on the plugin and on every component card of that plugin.
- **Toast:** confirms copies and install-list changes ("review-pack added to the install list").

### Behaviour notes

- The install list is stored in `localStorage` under `ddai.install-list` and survives page changes. Reading or writing storage must never break the page.
- The search, the facets and the URL update 60 ms after the last keystroke.
- On every page change, focus moves to the page's `h1` and the page scrolls to the top.

## URL scheme

All paths are under the `/dev-digest-ai-marketplace/` base path.

| Page | Path | Query parameters |
|---|---|---|
| Catalog and search | `/` | `q` (text), `type`, `plugin`, `category` (comma-separated values) |
| Plugin | `/plugins/<plugin>/` | – |
| Skill, agent or command | `/plugins/<plugin>/<type>s/<name>/` | – |
| Install list | `/install/` | – |

## Catalog record

The build produces one record per artifact (R4). Markdown fields are also delivered as HTML rendered at build time (`readmeHtml`, `changelogHtml`, `bodyHtml`).

| Field | Type | Applies to | Notes |
|---|---|---|---|
| `id` | string | all | `<plugin>` or `<plugin>/<type>/<name>` |
| `type` | string | all | `plugin`, `skill`, `agent`, `command`, `hook`, `mcp-server`, `lsp-server` |
| `name`, `description` | string | all | from the marketplace entry or frontmatter |
| `plugin` | string | all | parent plugin ID (its own ID for plugins) |
| `version`, `category` | string | all | from the parent plugin |
| `path` | string | hosted | repository path of the source file or plugin directory |
| `body` | string | skill, agent, command | Markdown body without frontmatter |
| `files` | string[] | skill | bundled files relative to the plugin directory |
| `tools` | string | agent | from frontmatter |
| `aliases` | string[] | all | from `plugin.json` `metadata.site.aliases` |
| `external` | boolean | plugin | `true` for entries with an external `source` |
| `readme`, `changelog` | string | plugin | Markdown |
| `security` | object | plugin | `hooks[] {event, matcher, command}`, `mcpServers[] {name, command}`, `lspServers[] {name, command}`, `executables[]` |

The `.claude/settings.json` generated by the install list (R21):

```json
{
  "extraKnownMarketplaces": {
    "dev-digest-ai": {
      "source": { "source": "github", "repo": "kosyakovr/dev-digest-ai-marketplace" }
    }
  },
  "enabledPlugins": {
    "review-pack@dev-digest-ai": true,
    "sdd-engineering@dev-digest-ai": true
  }
}
```

## Initial golden queries (R12)

They live in [site/tests/golden-queries.json](../../site/tests/golden-queries.json) and run with `npm test`. Every skill, agent and command must appear in at least one query; the tests fail otherwise.

| Query | Filters | Expectation |
|---|---|---|
| I need a skill for reviewing pull requests | – | only skills; `review-pack/skill/code-review` first |
| reveiw | – | `review-pack/skill/code-review` in the top 3 |
| spec | – | contains `write-spec`, `spec-to-plan`, `spec-reviewer` |
| write a spec | – | `sdd-engineering/skill/write-spec` in the top 3 |
| turn a spec into a plan | – | `sdd-engineering/skill/spec-to-plan` in the top 3 |
| agent that reviews code | – | only agents; `review-pack/agent/code-reviewer` first |
| review my spec | – | `sdd-engineering/agent/spec-reviewer` in the top 3 |
| spec driven development plugin | – | only plugins; `sdd-engineering` first |
| code review | – | `review-pack` in the top 3 |
| *(empty)* | type `agent`, plugin `sdd-engineering` | exactly `sdd-engineering/agent/spec-reviewer` |
| kubernetes helm charts | – | no results |

## Constraints and decisions

- **Hosting:** GitHub Pages project site at `https://kosyakovr.github.io/dev-digest-ai-marketplace/`. Every URL must work under the `/dev-digest-ai-marketplace/` base path. Deployment uses GitHub Actions, not a `gh-pages` branch.
- **Framework:** React with Vite, as a single-page app with client-side routing (React Router). Vite provides the local dev server (R34) and the production build.
- **Build and deploy:** `.github/workflows/pages.yml` runs on every push to `main`: install, test, build, then deploy with GitHub's Pages actions. The base path comes from the Pages configuration (`SITE_BASE`), so a custom domain needs no code change. GitHub Pages must use "GitHub Actions" as its source.
- **Direct URLs on GitHub Pages:** after the build, `scripts/write-routes.mjs` writes `dist/<route>/index.html` for every page with its own title and description, plus `404.html` for unknown paths. No hash URLs and no redirect tricks.
- **Catalog generation:** `site/catalog/build-catalog.mjs` reads the repository at build time and in the dev server (through a `virtual:catalog` Vite module). It covers the default component folders and paths set in `plugin.json`, renders Markdown with relative links resolved (R20), shows raw HTML in Markdown as text and drops HTML comments.
- **Search engine:** MiniSearch in the browser, implemented in `site/src/lib/search.js`:
  - Fields and boosts: name ×4, aliases ×3, description ×2, plugin ×1, body ×1.
  - Prefix matching for terms of 3+ characters. Fuzzy matching: 1 edit for 4–5 characters, 2 edits for 6+.
  - Light English stemming on both index and query: `-ing`, `-ed`, plural `-s`.
  - Query words are dropped if they are stop words ("I need a … for …") and turned into a type filter if they are type words.
  - Facet counts for each group ignore that group's own filter.
- **Site-only data location:** the free-form `metadata` field of `plugin.json`, which Claude Code does not read. Keys are `plugin` or `<type>/<name>`, for example `"metadata": { "site": { "aliases": { "plugin": ["pr tools"], "skill/code-review": ["pr review", "pull request review"] } } }`. This keeps the data with the plugin and out of the model's context. Adding a custom field to `SKILL.md` frontmatter also passes `validate --strict` (checked with CLI 2.1.296), but it mixes site concerns into files written for the model.
- **Code location:** the site lives in `site/`, separate from the marketplace content. It only reads `plugins/` and `.claude-plugin/`; nothing in the marketplace depends on it.
- **No runtime network calls** to GitHub or other APIs from the browser. Fonts are bundled with the site rather than loaded from Google Fonts. Anything external (for example star counts) is fetched at build time or not at all.
- **Language:** English only, in UI, content and search.

## Open questions

- Should the build fetch external-source plugins (by their pinned `sha`) to index their components, or stay with entry metadata only (R3)? Fetching improves search but makes the build depend on third-party repositories.
- Is a custom domain wanted, or does the `github.io` address stay?
- How many golden queries per artifact should R12 require once the catalog grows past a few dozen artifacts?
- Should the install builder also offer user-scope commands only (no settings file) as a first-class option, or is project scope the main path?
