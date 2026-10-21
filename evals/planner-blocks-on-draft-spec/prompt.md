---
plugins: ["../../plugins/engineering-paved-path", "../../plugins/research-tools", "../../plugins/architecture-review", "../../plugins/sdd-engineering"]
description: implementation-planner is reachable by its namespaced name and refuses to plan from a spec that is not approved.
tags: [sdd-engineering, namespace, agents]
max_turns: 10
timeout_seconds: 300
allowed_tools: [Agent, Write]
runs: 3
---
Write this file to docs/specs/export-csv.md exactly as given, then ask the sdd-engineering:implementation-planner agent to plan it (spec path: docs/specs/export-csv.md) and relay its answer.

# Export runs as CSV
**Status:** draft

## Goal
Users can download their run history as a CSV file.

## Acceptance criteria
- **AC-1** (US-1 · S-1) WHEN the user clicks "Export CSV", the history page SHALL download a file named runs.csv.
