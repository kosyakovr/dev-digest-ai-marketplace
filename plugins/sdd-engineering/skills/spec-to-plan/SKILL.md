---
name: spec-to-plan
description: Turns an approved feature spec into an ordered implementation plan whose tasks trace back to requirement IDs. Use when a spec exists and the user asks how to implement it or wants a plan or task breakdown.
---

# Spec to plan

> **Stub.** The workflow below is the intended shape; fill in the TODOs before release.

## Workflow

1. **Load the spec.** Read the spec file. Stop and ask if its status is not `approved` or if it has open questions.
2. **Map the codebase.** For each requirement, find the files and modules that must change.
3. **Break down into tasks.** Each task:
   - is small enough for one reviewable commit;
   - lists the requirement IDs it satisfies (`R1`, `R3`);
   - names the test that proves it.
4. **Order the tasks** so that each one leaves the build green.
5. **Check coverage.** Every requirement ID appears in at least one task; report any that do not.
6. **Save the plan** next to the spec as `docs/specs/<feature-slug>.plan.md`.
   <!-- TODO: define the plan file format. -->
