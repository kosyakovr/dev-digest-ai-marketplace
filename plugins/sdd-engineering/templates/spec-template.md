# <Feature name>

**Status:** draft | approved | in-progress | done
**Ticket:** <issue, ticket or "none">
**Areas:** <the packages, services or apps that change — as the project names them>

<!--
Rules for whoever fills this in (the spec-creator agent or a person):
- WHAT and WHY only. No files, layers, libraries or step order — that is the
  Implementation Plan's job. The one exception is § Contract: the boundary
  between areas (routes, payload shapes, shared schemas, tools, UI surface).
- Every requirement carries an ID and its source (S-n, or "request").
- Behaviour that already exists is marked `existing` with `path:line`, never re-specified as new.
- At most 3 `[NEEDS CLARIFICATION: …]` markers; everything else gets a default under § Assumptions.
- IDs (US, AC, NFR, A, P, S) are stable: never renumber or reuse one; a dropped
  requirement stays in place as `withdrawn — <why>`, so the plan's citations keep pointing right.
- Size the spec to the change: a small change fits in ~60 lines, a feature in ~150.
- Delete a section's placeholder text; write "none" in a section that does not apply.
-->

## Goal
The problem, for whom, and why now — 2–5 sentences. No solution design.

## Non-goals
- What this feature deliberately does not do (and, if useful, where that lives instead).

## Sources
| ID | Source | What it contributes |
|---|---|---|
| S-1 | request — user text, <date> | <…> |
| S-2 | design — <Figma frame / image / design export>, saved at `<path>` | <screens, states shown> |
| S-3 | existing code — `<path:line>` (existing) | <behaviour that already exists> |

## User stories
### US-1 — <short title> (P1)
As a <role>, I want <capability>, so that <outcome>.
**Independent test:** <how this story alone can be shown to work>.

### US-2 — <short title> (P2)
…

## Contract
The boundary only — what one area exposes to another or to the user.

- **Routes / APIs:** `<METHOD> /path` — request, response shape, error codes.
- **Shared schemas:** schemas or types shared between areas, added or changed (every copy, if the project keeps more than one).
- **Tools / commands:** name, input, output (CLI commands, MCP tools, jobs).
- **UI surface:** screen, entry point, components the user sees.
- **Persistence:** what must be stored or kept (not the table design). A new or
  changed table needs a migration — a user gate.

### Module interaction
Who calls whom, in order (a numbered list, or a Mermaid `sequenceDiagram` for 3+ hops).

## Acceptance criteria
EARS: `WHILE <state>, WHEN <trigger>, the <system> SHALL <response>` · `IF <unwanted condition>, THEN the <system> SHALL <response>` · `WHERE <feature/flag>, the <system> SHALL <response>` · `The <system> SHALL <response>`.
One trigger and one system per criterion; every criterion observable (a status code, a rendered element, a row, a file).

- **AC-1** (US-1 · S-1) WHEN <trigger>, the <system> SHALL <response>.
- **AC-2** (US-1 · S-2) IF <error>, THEN the <system> SHALL <response>.

### Must keep working
- **AC-n** (existing · `path:line`) WHEN <trigger>, the <system> SHALL CONTINUE TO <current behaviour>.

## States and edge cases
One row per screen or component the feature adds or changes.

| Surface | Default | Loading | Empty | Error | Partial / degraded | No access | Stale / expired |
|---|---|---|---|---|---|---|---|
| <name> | AC-1 | AC-3 | not shown in design → A-1 | AC-2 | n/a | … | … |

Other edge cases (limits, concurrency, very large input, offline, retries): each → an AC, an assumption or a marker.

## Non-functional
Only what can be measured: each NFR is an EARS sentence with a fit criterion — a number with its
unit, or a pass/fail observation — taken from a source or an assumption, never invented.
Walk the categories; skip silently the ones the feature does not touch.

- **NFR-1** (time budget · S-n) WHEN <operation> runs, the <system> SHALL <finish | stop and show X> within <n s>.
- **NFR-2** (external calls · A-n) WHEN <trigger>, the <system> SHALL make at most <n> call(s) to <service>.

Categories: time budget and what the user sees past it · external and paid calls (count per trigger, caps, cost, who pays) ·
reliability (retry, idempotency, partial results) · privacy (what leaves the machine or the service, and what is stored) ·
untrusted input (user or third-party text reaching a prompt, a query or the page) · accessibility (keyboard, focus, contrast, `aria-*`, text for colour-only signals) ·
observability (what is logged or shown to diagnose a failure) · wording (exact user-visible and error text, where it is pinned).

## Assumptions
- **A-1** <default taken where the sources are silent> — because <reason>.

## Open questions
- [NEEDS CLARIFICATION: <question> — options: <A> (recommended) | <B>] (at most 3, or "none")

## Proposals
Not requirements until the user accepts them.
- **P-1** <UX or scope improvement> — why (<heuristic or evidence>) — accepted | rejected | pending

## Traceability and verification
One row per AC and NFR — none missing, none extra. **Method:** test · demo (shown by hand in the
running app) · inspection (read the code or contract) · analysis (measured or computed).
**Suite** is a test suite as the project names it (its test docs, CI jobs or package scripts),
or `—` for demo, inspection and analysis. The **hint** names the observable signal that proves the
criterion, not a test case — the cases are the Implementation Plan's Test brief.
A small change (~60 lines) may drop the Story and Source columns; the AC's tag carries them.
`spec-lint.sh` (shipped with the sdd-engineering plugin) checks this table and the self-check items it can.

| ID | Story | Source | Method | Suite | Verification hint |
|---|---|---|---|---|---|
| AC-1 | US-1 | S-1 | test | <suite> | `GET /…` → 200, body has `<field>` |
| AC-2 | US-1 | S-2 | test | <suite> | the error text and a retry button render; no request fires twice |
| NFR-1 | US-1 | A-1 | demo | — | past <n s> the notice reads "<text>" |

## Self-check
Ticked by whoever wrote the spec; an unticked box is a finding for the planner's Requirements review.

- [ ] Every AC and NFR is one EARS sentence with one trigger and an observable response — no "fast", "properly", "gracefully".
- [ ] Every number is sourced (`S-n`) or an assumption (`A-n`).
- [ ] Every user story has an AC and an Independent test; every `S-n` is cited at least once.
- [ ] Every state-matrix cell holds an AC, an `A-n`, a marker or `n/a`.
- [ ] Every AC and NFR has a row in § Traceability and verification.
- [ ] No HOW: no file to change, library, layer or work order outside § Sources and § Must keep working.
- [ ] A changed shared schema names every copy; a stored field names the migration gate.
- [ ] At most 3 `[NEEDS CLARIFICATION]` markers, each repeated under § Open questions.
