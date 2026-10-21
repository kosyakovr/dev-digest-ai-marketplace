# Catalog site

The searchable catalog of the `dev-digest-ai` marketplace, published to GitHub Pages at
<https://kosyakovr.github.io/dev-digest-ai-marketplace/>. Spec: [docs/specs/catalog-site.md](../docs/specs/catalog-site.md).

The site lives in its own directory and never changes the marketplace. It reads the marketplace at build time: no sample or hand-written catalog data. It lists every plugin under `plugins/` (the latest channel) plus external entries of `.claude-plugin/marketplace.json` (the stable channel), with pages built from the working tree, and marks each plugin's stable version, or "latest only", and its latest version ([release channels spec](../docs/specs/release-channels.md), R15). The install page emits the add command, install commands and team settings of the channel the user picks.

## Develop

Requires Node.js 22.12 or newer.

```bash
cd site
npm install
npm run dev        # http://localhost:5173/dev-digest-ai-marketplace/
```

The dev server regenerates the catalog and reloads the page whenever a file under `plugins/` or `.claude-plugin/` changes.

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server with live catalog reload |
| `npm test` | Catalog generation, golden search queries, install output |
| `npm run build` | Production build into `dist/`, with one HTML file per page |
| `npm run preview` | Serve the production build locally |
| `npm run catalog` | Print what the catalog contains (`-- --json` for the full data) |

## How it works

```
plugins/ + .claude-plugin/ ──► catalog/build-catalog.mjs ──► virtual:catalog ──► React app (src/)
                                                                      │
                               vite build ──► dist/ ──► scripts/write-routes.mjs (one index.html per page + 404.html)
```

- `catalog/build-catalog.mjs` scans the marketplace: plugins, skills, agents, commands, hooks, MCP and LSP servers and `bin/` executables, including paths set in `plugin.json`. It renders Markdown to HTML at build time and fails the build on invalid frontmatter.
- A stable pin's version is read from `plugins/<name>/.claude-plugin/plugin.json` at the pinned commit with `git show`, so the build needs the full history (`fetch-depth: 0` in CI). If git cannot read it, the build fails.
- `src/lib/search.js` is the search engine (MiniSearch with stemming, stop words and type words).
- `scripts/write-routes.mjs` writes `dist/<route>/index.html` for every page, so every URL loads directly on GitHub Pages with its own title and description.

## Deploy

`.github/workflows/pages.yml` builds and deploys on every push to `main`. Plugin changes redeploy the site too. Pull requests run the same tests and build in the required **Validate** check, without deploying.

The base path comes from GitHub Pages (`SITE_BASE`), so a custom domain needs no code change.

## When you add a skill, agent or command

Add at least one query for it to [tests/golden-queries.json](tests/golden-queries.json). The tests fail until every skill, agent and command has a golden query, so search quality cannot silently regress.
