# architecture-review

An `architecture-reviewer` agent that checks whether a change keeps the
architectural boundaries your repository has written down. Every finding names
the rule, the `path:line` that breaks it and the quoted line, and is re-checked
before it is reported.

## Install

```bash
claude plugin marketplace add kosyakovr/dev-digest-ai-marketplace
claude plugin install architecture-review@dev-digest-ai
```

Installing it also installs `engineering-paved-path ^1.0.0`, whose architecture skills it loads. It is itself a dependency of `sdd-engineering`.

## Components

| Type | Name | Invoke as | Purpose |
|---|---|---|---|
| Agent | `architecture-reviewer` | `architecture-review:architecture-reviewer` | Read-only boundary review of an uncommitted change, a commit range or paths |

## Where the rules come from

1. **Your architecture docs** — `ARCHITECTURE.md`, `docs/architecture/**`, `docs/adr/**`, and the architecture sections of `CLAUDE.md` / `AGENTS.md`, or the paths you pass as `architecture_docs`. Explicit layer maps and recorded exceptions there win.
2. **engineering-paved-path skills** — `engineering-paved-path:onion-architecture`, `engineering-paved-path:frontend-ui-architecture`, `engineering-paved-path:next-best-practices`, routed by `engineering-paved-path:skill-routing`.

The report lists which docs it read and which it looked for and did not find. With no docs, it reviews against the skills only and says so.

## Usage

"Run architecture-review:architecture-reviewer on the uncommitted change", or on a range (`main..HEAD`) or a list of paths. Inside `/sdd-engineering:sdd-run` it runs after the implementation and again on each fix round's delta.

Severity is CRITICAL / WARNING / SUGGESTION, with a written CRITICAL bar; the verdict (`approve`, `comment`, `request_changes`) is a pure function of the findings.

## Inputs

| Input | Default |
|---|---|
| `change_scope` — uncommitted, `base..head`, paths, or a change manifest file | uncommitted vs `HEAD` |
| `architecture_docs` | discovered (see above) |
| base revision for grep fitness checks | the range base, or `HEAD` |

## What runs on your machine

Read-only `git` and `grep` commands. No writes, no builds or tests, no hooks, no MCP servers, no credentials.
