# Changelog

All notable changes to `sdd-engineering` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [1.3.0]

### Removed
- `spec-creator` rule 10, added in 1.1.0: spec-creator again finishes a spec without requiring every mandatory user story to have an acceptance criterion that is not withdrawn. The report header drops `Stories with AC: <n>/<n>`, the handoff line no longer names uncovered stories, and an uncovered story no longer makes the Status `blocked` on its own. The agent, the spec template and `spec-lint.sh` are back to their 1.0.0 text; the dependency changes of 1.2.0 stay.
- Spec template: the rule above and the withdrawn-story heading form.
- Eval case `spec-creator-keeps-every-story-covered`, which tested rule 10.

### Changed
- `spec-lint.sh` `no-ac` is back to its 1.0.0 behaviour: a story counts as covered when any AC or NFR cites it, withdrawn or not, and the detail reads `<US-n> has no AC or NFR`. Check name, line format and exit codes are unchanged.

### Compatibility
- Backward compatible: no agent, input, `Status:` value or parsed report heading changed. `Stories with AC` was informational and nothing parses it.

## [1.2.0]

### Added
- `metadata.category` in `plugin.json`, the source the generated latest catalog takes the plugin's category from (spec `docs/specs/release-channels.md`, R9).

### Changed
- Dependencies are declared by name only (`engineering-paved-path`, `research-tools` and `architecture-review`), so Claude Code resolves them inside the user's release channel instead of against repository-wide tags. The compatibility range (`^1.0.0` each) moved to `metadata.compat`, where the marketplace's CI checks it; Claude Code no longer checks it at load time (spec R6, R7).

## [1.1.0]

### Added
- `spec-creator` rule 10: a spec is not finished while a mandatory requirement has no acceptance criterion. Every user story is mandatory, whatever its priority, until the user withdraws it; it needs at least one AC that cites it and is not withdrawn (an NFR, an Independent test, a proposal or a withdrawn AC does not count). The report says `ready to plan` only when every such story is covered; a story still uncovered after the self-check makes it `blocked`. The report header adds `Stories with AC: <n>/<n>`, and the handoff line names uncovered stories.
- Spec template: the rule above, and the form of a withdrawn story heading (`— withdrawn — <why> (user · <date>)`).
- Eval case `spec-creator-keeps-every-story-covered` (repository-level `evals/`): the user withdraws a story's only AC in a resolution round; spec-creator must withdraw the AC, keep the story and cover it again (a sourced AC or one with a marker) or ask the user.

### Changed
- `spec-lint.sh` `no-ac`: a story is covered only by an AC that cites it and is not withdrawn; an NFR or a withdrawn AC no longer counts. A withdrawn story is exempt, and an AC that cites several stories covers each of them. The detail now reads `<US-n> has no acceptance criterion`; the check name, line format and exit codes are unchanged.

### Compatibility
- Backward compatible: no agent, input, report heading or `Status:` value changed. A spec approved under 1.0.0 can get a new `no-ac` line from `spec-lint.sh`; `implementation-planner` treats it as a requirement to review and `sdd-run` relays it, as with every lint line, so neither blocks on it.

## [1.0.0]

### Added
- Agents `spec-creator`, `implementation-planner`, `test-writer`, `implementer` and `plan-verifier`, ported from the DevDigest project and generalised: explicit `## Inputs` instead of a fixed repository layout, skills loaded as `engineering-paved-path:*`, no frontmatter hooks or MCP tools.
- `/sdd-engineering:sdd-run`: runs an approved spec and plan through T1 tests → implementer → T2 tests → plan-verifier ∥ `architecture-review:architecture-reviewer` → up to two fix rounds → engineering insights → commit on the user's word, resumable from the plan's Run log.
- `workflow-retro` (run retrospective from local transcripts) and `engineering-insights` (append-only `INSIGHTS.md` capture).
- Plugin-level `templates/spec-template.md`, `reference/sdd-files.md`, `scripts/spec-lint.sh` (with an offline self-test) and `scripts/change-set.sh`.
- Dependencies on `engineering-paved-path`, `research-tools` and `architecture-review`, each `^1.0.0`.
- Eval cases (in the marketplace's repository-level `evals/`, which loads all four plugins) that check the namespaced agents are reachable and `sdd-run` never fires on its own.

### Removed
- The `write-spec` and `spec-to-plan` skill stubs and the `spec-reviewer` agent stub.

## [0.1.0]

### Added
- Initial stub: `write-spec` skill with spec template, `spec-to-plan` skill, `spec-reviewer` agent.
