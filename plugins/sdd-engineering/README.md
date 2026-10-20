# sdd-engineering

A spec-driven development (SDD) harness for Claude Code. A spec becomes a plan,
the plan becomes tests and code, and independent agents verify the result
against the plan item by item. Nothing is committed without your word.

## Install

```bash
claude plugin marketplace add kosyakovr/dev-digest-ai-marketplace
claude plugin install sdd-engineering@dev-digest-ai
```

Installing `sdd-engineering` also installs its dependencies:
`engineering-paved-path`, `research-tools` and `architecture-review` (each `^1.0.0`).

## Components

| Type | Name | Invoke as | Purpose |
|---|---|---|---|
| Agent | `spec-creator` | `sdd-engineering:spec-creator` | Writes a draft spec with EARS acceptance criteria, sources, assumptions and at most 3 open questions |
| Agent | `implementation-planner` | `sdd-engineering:implementation-planner` | Reviews the requirements and writes a plan: work packages, skill sections that bind them, gates, test plan, T1/T2 test brief |
| Agent | `test-writer` | `sdd-engineering:test-writer` | Writes tests from the plan, not from the code, and proves each one fails without its behaviour |
| Agent | `implementer` | `sdd-engineering:implementer` | Implements an approved plan; writes no tests, never commits |
| Agent | `plan-verifier` | `sdd-engineering:plan-verifier` | Grades every plan item PASS / FAIL / UNVERIFIABLE with its own evidence |
| Skill | `sdd-run` | `/sdd-engineering:sdd-run <spec>` | Runs an approved spec + plan end to end (user-invoked only) |
| Skill | `workflow-retro` | `/sdd-engineering:workflow-retro` | Measures a finished run from its transcripts and proposes at most 5 changes |
| Skill | `engineering-insights` | `/sdd-engineering:engineering-insights` | Reads and appends `INSIGHTS.md` files; writes nothing that fails its gate |

## Workflow

1. Ask Claude to run `sdd-engineering:spec-creator` with your request and any design files. Answer its questions; it folds the answers in. When you are happy, say "spec approved".
2. Ask Claude to run `sdd-engineering:implementation-planner` on the spec. Save the plan, answer its Gates and the execution-mode question, then say "plan approved".
3. Run `/sdd-engineering:sdd-run docs/specs/<feature>.md`. After one confirmation it runs test-writer T1 → implementer → test-writer T2 → plan-verifier ∥ `architecture-review:architecture-reviewer` → at most two fix rounds → engineering-insights, and asks before committing.
4. Afterwards, `/sdd-engineering:workflow-retro` shows what the run cost and where it wasted effort.

The full picture, with a diagram, is in the [marketplace README](../../README.md#how-the-plugins-work-together).

## Inputs

No agent assumes a repository layout. `/sdd-engineering:sdd-run` resolves each input once — `--input name=value`, then an `## SDD` section in your `CLAUDE.md` or `AGENTS.md`, then the default, then one question — and passes it to every agent.

| Input | Default |
|---|---|
| `spec_dir` | `docs/specs/` |
| `plan_path` | `docs/plans/<spec file name>` |
| `check_commands` | the plan's Test plan (the planner takes it from CI config, package scripts or your docs) |
| `protected_paths` | lock files, migration directories, `.git/`, `.claude/`, `CLAUDE.md`, `AGENTS.md`, the spec and plan folders |
| `architecture_docs` | discovered: `ARCHITECTURE.md`, `docs/architecture/**`, `docs/adr/**` |
| `insights_files` | the nearest `INSIGHTS.md` above the changed files |
| `run_dir` | `.git/sdd/runs/<plan name>` (outside the working tree) |

Example `## SDD` section:

```markdown
## SDD
- spec_dir: specs/
- check_commands: pnpm -r typecheck && pnpm -r test
- architecture_docs: docs/architecture.md
```

Shared definitions live in the plugin and are referenced through `${CLAUDE_PLUGIN_ROOT}`: [templates/spec-template.md](templates/spec-template.md), [reference/sdd-files.md](reference/sdd-files.md) (spec and plan lifecycle), [scripts/spec-lint.sh](scripts/spec-lint.sh), [scripts/change-set.sh](scripts/change-set.sh).

## What runs on your machine

- **Shell scripts** (bash): `spec-lint.sh` reads a spec; `change-set.sh` reads git state and writes only unreferenced git objects for snapshots; `sdd-run/scripts/save-report.sh` (python3, stdlib) copies an agent's report from its local transcript into the run directory.
- **Node script**: `workflow-retro/scripts/retro.mjs` reads Claude Code transcripts under `~/.claude/projects/<project>/` locally, sends nothing anywhere, and writes only the JSON report you name and one ledger row.
- No hooks, no MCP servers, no network calls of its own, no credentials.

**Scope rules are not a sandbox.** Plugin agents cannot carry hook guards, so the limits (implementer writes no tests, nobody commits or touches lock files, read-only agents write nothing) are enforced by each agent's tool list and prompt, not mechanically. Review the diff before you commit.

## Evals

`evals/` checks that the agents are reachable by their namespaced names and that `sdd-run` never fires on its own. They make paid model calls; run them by hand before a release:

```bash
claude plugin eval plugins/sdd-engineering --no-publish
```
