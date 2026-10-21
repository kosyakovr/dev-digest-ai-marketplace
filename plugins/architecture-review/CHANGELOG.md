# Changelog

All notable changes to `architecture-review` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [1.1.0]

### Added
- `metadata.category` in `plugin.json`, the source the generated latest catalog takes the plugin's category from (spec `docs/specs/release-channels.md`, R9).

### Changed
- Dependencies are declared by name only (`engineering-paved-path`), so Claude Code resolves them inside the user's release channel instead of against repository-wide tags. The compatibility range (`^1.0.0`) moved to `metadata.compat`, where the marketplace's CI checks it; Claude Code no longer checks it at load time (spec R6, R7).

## [1.0.0]

### Added
- `architecture-reviewer` agent, ported from the DevDigest project and generalised: it reads the repository's own architecture docs and ADRs (`architecture_docs` input, discovered when not given) and loads `engineering-paved-path` architecture skills by namespace. It owns its severity scale, CRITICAL bar and verdict, and runs the skills' grep fitness checks by subtraction against a base revision.
- Dependency on `engineering-paved-path ^1.0.0`.

### Removed
- The `code-review` skill and `code-reviewer` agent stubs.

## [0.2.0]

### Changed
- Renamed the plugin from `review-pack` to `architecture-review`. The marketplace maps the old name in `renames`. The install ID is now `architecture-review@dev-digest-ai` and skills are invoked as `/architecture-review:<skill>`.

## [0.1.0]

### Added
- Initial stub: `code-review` skill with checklist, `code-reviewer` agent.
