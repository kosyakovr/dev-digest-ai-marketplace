---
name: write-spec
description: Writes a feature specification (problem, goals, non-goals, requirements, acceptance criteria) before any code is written. Use when the user starts a new feature or asks for a spec, PRD or requirements document.
---

# Write a spec

> **Stub.** The workflow below is the intended shape; fill in the TODOs before release.

## Workflow

1. **Clarify the problem.** Ask at most three questions about who the user is, what hurts today and how success is measured. Skip questions the codebase or conversation already answers.
2. **Explore the codebase.** Find the modules the feature touches and note existing constraints.
3. **Draft the spec** from [templates/spec-template.md](templates/spec-template.md). Every requirement gets a stable ID (`R1`, `R2`, …) and at least one testable acceptance criterion.
4. **Save it** to `docs/specs/<feature-slug>.md`.
   <!-- TODO: make the output directory configurable. -->
5. **Hand off.** Suggest a review by the `spec-reviewer` agent, then the `spec-to-plan` skill.

## Rules

- No implementation details in requirements; describe behaviour, not code.
- Non-goals are mandatory. They prevent scope creep later.
- Mark unknowns explicitly as `Open question:` rather than guessing.
