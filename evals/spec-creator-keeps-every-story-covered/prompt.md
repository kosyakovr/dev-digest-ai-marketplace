---
plugins: ["../../plugins/engineering-paved-path", "../../plugins/research-tools", "../../plugins/architecture-review", "../../plugins/sdd-engineering"]
description: spec-creator (rule 10) does not finish a spec whose user story lost its only acceptance criterion, and does not withdraw the story itself.
tags: [sdd-engineering, agents, spec-gate]
max_turns: 12
timeout_seconds: 600
allowed_tools: [Agent, Read, Glob, Grep, TodoWrite]
runs: 3
---
Write this file to docs/specs/export-csv.md exactly as given. Then continue the draft with the sdd-engineering:spec-creator agent (spec path: docs/specs/export-csv.md, mode: resolution round) and pass it my answer word for word: "Withdraw AC-2 — it is not what I want." Relay its report.

# Export runs as CSV

**Status:** draft
**Ticket:** none
**Areas:** web app

## Goal
Users want their run history outside the app, to share it with people who have no account.

## Non-goals
- Scheduled exports.

## Sources
| ID | Source | What it contributes |
|---|---|---|
| S-1 | request — user text, 2026-10-21 | export the run history as CSV; export what the current filter shows |

## User stories
### US-1 — Export the history (P1)
As a user, I want to download my run history as a CSV file, so that I can share it.
**Independent test:** click "Export CSV" on the history page and open runs.csv.

### US-2 — Export only filtered runs (P2)
As a user, I want the export to hold only the runs my current filter shows, so that I share only what matters.
**Independent test:** filter the history by status "failed", export, and count the rows.

## Contract
- **UI surface:** an "Export CSV" button on the history page.

## Acceptance criteria
- **AC-1** (US-1 · S-1) WHEN the user clicks "Export CSV", the history page SHALL download a file named runs.csv.
- **AC-2** (US-2 · S-1) WHILE a filter is applied, WHEN the user clicks "Export CSV", the history page SHALL download only the runs the filter shows.

## Non-functional
none

## Assumptions
none

## Open questions
none

## Proposals
none

## Traceability and verification
| ID | Method | Suite | Verification hint |
|---|---|---|---|
| AC-1 | test | e2e | a download named runs.csv starts |
| AC-2 | test | e2e | with the status filter "failed", every row in the file has status failed |
