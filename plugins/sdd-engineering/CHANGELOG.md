# Changelog

All notable changes to `sdd-engineering` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [1.0.0]

### Added
- Agents `spec-creator`, `implementation-planner`, `test-writer`, `implementer` and `plan-verifier`, ported from the DevDigest project and generalised: explicit `## Inputs` instead of a fixed repository layout, skills loaded as `engineering-paved-path:*`, no frontmatter hooks or MCP tools.
- `/sdd-engineering:sdd-run`: runs an approved spec and plan through T1 tests → implementer → T2 tests → plan-verifier ∥ `architecture-review:architecture-reviewer` → up to two fix rounds → engineering insights → commit on the user's word, resumable from the plan's Run log.
- `workflow-retro` (run retrospective from local transcripts) and `engineering-insights` (append-only `INSIGHTS.md` capture).
- Plugin-level `templates/spec-template.md`, `reference/sdd-files.md`, `scripts/spec-lint.sh` (with an offline self-test) and `scripts/change-set.sh`.
- Dependencies on `engineering-paved-path`, `research-tools` and `architecture-review`, each `^1.0.0`.
- `evals/` cases that check the namespaced skills and agents are reachable.

### Removed
- The `write-spec` and `spec-to-plan` skill stubs and the `spec-reviewer` agent stub.

## [0.1.0]

### Added
- Initial stub: `write-spec` skill with spec template, `spec-to-plan` skill, `spec-reviewer` agent.
