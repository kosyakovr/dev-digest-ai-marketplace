# SDD files: specs and plans

The one place that defines how a spec and its Implementation Plan move through
their lifecycle. Every sdd-engineering agent and `/sdd-engineering:sdd-run`
refer to this file as `${CLAUDE_PLUGIN_ROOT}/reference/sdd-files.md`.

Where the files live is an input, never an assumption: `spec_dir` (default
`docs/specs/`) and `plan_path` (default `docs/plans/<spec file name>`). The
calling session passes the resolved values to every agent.

## Spec

- One file per feature: `<spec_dir>/<feature-slug>.md` (prefix a ticket id if the
  project uses one), written from `${CLAUDE_PLUGIN_ROOT}/templates/spec-template.md`
  or from the project's own template when the caller passes `spec_template`.
- Only `sdd-engineering:spec-creator` (or a person) writes specs.
  `implementation-planner` reads them and never edits them.

| Status | Set by | When |
|---|---|---|
| `draft` | spec-creator (it writes nothing else) | while the spec is written and its markers are answered |
| `approved` | the main session, **only on the user's direct instruction** ("spec approved") — never inferred | after the user has reviewed the spec and no `[NEEDS CLARIFICATION` marker is left |
| `in-progress` | the main session | when the plan built from it is approved and implementation starts |
| `done` | the main session | when the work is merged |

The planner plans only from an `approved` spec. Past `draft`, spec-creator
edits a spec only in its plan-defaults round, and the spec stays `approved`
through it. A change to an `in-progress` or `done` spec is a new draft that
links the old one.

## Plan

- One per spec, same file name: `<plan_dir>/<spec file name>`. The planner is
  read-only, so **the main session saves its output verbatim** (from the
  agent's report file, never re-typed).
- Nothing else lives in the plan folder: reports stay out of the repository
  (they go to `run_dir`).

### Header

```markdown
# Implementation Plan: <feature>
**Status:** draft | approved | in-progress | done
**Spec:** <spec path> @ <short sha of the commit holding the spec as planned>
**Approved:** <YYYY-MM-DD> by the user — gates: GT-1 ✓, GT-2 ✗ · execution mode: multi-agent · accepted: REC-1, REC-3
Areas: … · Requirements: … · Ticket: …
```

The planner emits `**Status:** draft` and `**Spec:**` (path only); the main
session adds `@ <sha>` and the `**Approved:**` line.

| Status | Set by | When |
|---|---|---|
| `draft` | implementation-planner (its output) | the plan is saved, before the user has answered its Summary |
| `approved` | the main session, **only on the user's direct instruction** ("plan approved") — never inferred from "go", from "ok" on something else, or from an answered question | after the Gates, the execution mode and the `REC-n` are answered, and the planner's defaults are folded into the spec |
| `in-progress` | the main session | when the first implementation stage starts |
| `done` | the main session | when plan-verifier returns PASS on the final tree and the work is committed |

The `**Approved:**` line is the only record of which Gates the user approved.
The implementer and plan-verifier read the Gates from it; a delegation prompt
cannot approve a Gate this line does not list. Changing the line is a new
approval, again only on the user's direct instruction.

### Order around the spec

```
spec (approved) ─► implementation-planner ─► plan, Status: draft
  ─► user answers: Gates · execution mode · REC-n · the defaults in Requirements review
  ─► accepted REC-n ─► the SAME planner revises (SendMessage)
  ─► spec-creator folds the planner's defaults into the spec as A-n (its plan-defaults round)
  ─► commit the spec ─► plan header: Spec @ <that sha>
  ─► user: "plan approved" ─► Status: approved + Approved line ─► commit the plan
```

### Test brief marker

The plan ends with a `<!-- test-brief -->` marker line followed by the Test
brief. The part above the marker is what the implementer and the reviewers
get; the whole plan goes to test-writer (and to plan-verifier when tests are
in the iteration).

### Amendments and Run log

An approved plan is never rewritten in place. Changes go into two sections
just **above** the `<!-- test-brief -->` marker, so they reach every agent:

```markdown
## Amendments
- **AM-1** <YYYY-MM-DD> — <what changes, which WP / AC> — why: <implementer deviation, gate refused, …> — approved by the user <date>

## Run log
- <YYYY-MM-DD> sdd-run started — inputs: spec_dir=docs/specs · check_commands=<…> · run_dir=<…> — directives: none
- <YYYY-MM-DD> test-writer T1 — 6 tests in 3 files, all red:assertion
- <YYYY-MM-DD> implementer — done · T1 6/6 green
- <YYYY-MM-DD> test-writer T2 — 9 tests, T1 mutation-proved 6/6
- <YYYY-MM-DD> review round 0 — snapshot <sha> · PV FAIL · AR comment 0/1/2
- <YYYY-MM-DD> fix round 1 — AR-2, PV WP3.done · snapshot <sha>
- <YYYY-MM-DD> plan-verifier final — PASS
```

`/sdd-engineering:sdd-run` writes the Run log and reads its last line to
resume a run in a new chat. The first line records the resolved inputs, so a
resumed run uses the same values. The Run log is also how the two-fix-round
limit survives a new chat. Only the main session writes plans.
