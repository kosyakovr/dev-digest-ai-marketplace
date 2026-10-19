---
name: code-review
description: Reviews a diff, branch or pull request for correctness bugs, security issues and maintainability problems, and reports verified findings ranked by severity. Use when the user asks to review changes, a diff, a commit, a branch or a PR.
---

# Code review

> **Stub.** The workflow below is the intended shape; fill in the TODOs before release.

## Workflow

1. **Determine scope.** Find what to review: uncommitted changes (`git diff`), a branch against its base (`git diff <base>...HEAD`), or a PR.
   <!-- TODO: add PR support (gh pr diff) and a rule for picking the base branch. -->
2. **Read the context.** For each changed file, read enough of the surrounding code to understand intent. Do not review lines in isolation.
3. **Apply the checklist.** Go through [references/checklist.md](references/checklist.md) in order.
4. **Verify each finding.** Before reporting, confirm the issue with a concrete failure scenario (input → wrong output or crash). Drop anything you cannot substantiate.
5. **For large diffs** (TODO: define threshold), delegate an independent pass to the `code-reviewer` subagent and merge its verified findings.

## Output format

Report findings most-severe first:

```
### [severity] <one-line summary>
File: path/to/file.ext:LINE
Scenario: <concrete inputs/state → wrong result>
Fix: <smallest change that resolves it>
```

Severity levels: `critical`, `major`, `minor`, `nit`.
<!-- TODO: decide whether nits are reported by default. -->

If nothing survives verification, say so plainly. Do not pad the report.
