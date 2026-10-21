# Changelog

All notable changes to `research-tools` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [1.1.0]

### Added
- `metadata.category` in `plugin.json`, the source the generated latest catalog takes the plugin's category from (spec `docs/specs/release-channels.md`, R9).

## [1.0.0]

### Added
- `researcher` agent, ported from the DevDigest project and generalised: a read-only investigator for repository and external questions that returns evidence-backed reports with an explicit "not found" list.

### Removed
- The `research-topic` and `compare-options` skill stubs and the `source-checker` agent stub.

## [0.1.0]

### Added
- Initial stub: `research-topic` skill with report template, `compare-options` skill, `source-checker` agent.
