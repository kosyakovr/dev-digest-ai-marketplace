# sdd-engineering

Spec-driven development workflow for Claude Code: spec first, then plan, then code.

> **Status:** stub (0.1.0). Components exist but their instructions are not final.

## Components

| Type | Name | Purpose |
|---|---|---|
| Skill | `write-spec` | Drafts a spec with requirement IDs and acceptance criteria |
| Skill | `spec-to-plan` | Turns an approved spec into an ordered, traceable task plan |
| Agent | `spec-reviewer` | Reviews a spec for ambiguity and untestable requirements |

## Install

```bash
claude plugin marketplace add kosyakovr/dev-digest-ai-marketplace
claude plugin install sdd-engineering@dev-digest-ai
```

## Workflow

1. `/sdd-engineering:write-spec`: draft `docs/specs/<feature>.md`
2. Ask Claude to run the `spec-reviewer` agent on it and resolve the issues
3. `/sdd-engineering:spec-to-plan`: produce `docs/specs/<feature>.plan.md`
