# Review checklist

> **Stub.** Extend each section with project-specific rules.

## 1. Correctness
- Off-by-one errors, wrong boundary conditions, inverted conditions.
- Unhandled `null` / `undefined` / empty collections.
- Error paths: are errors caught, propagated, or silently swallowed?
- Concurrency: shared mutable state, missing awaits, race conditions.
<!-- TODO -->

## 2. Security
- Untrusted input reaching queries, shell commands, file paths or HTML.
- Secrets in code, logs or error messages.
- Authorization checks on every new entry point.
<!-- TODO -->

## 3. Maintainability
- Names that match behaviour; no misleading comments.
- Duplicated logic that already exists elsewhere in the codebase.
- Tests cover the changed behaviour, including the failure path.
<!-- TODO -->
