# review-pack

Code review toolkit for Claude Code.

> **Status:** stub (0.1.0). Components exist but their instructions are not final.

## Components

| Type | Name | Purpose |
|---|---|---|
| Skill | `code-review` | Reviews a diff/branch/PR and reports verified findings ranked by severity |
| Agent | `code-reviewer` | Independent reviewer that runs in its own context |

## Install

```bash
claude plugin marketplace add kosyakovr/dev-digest-ai-marketplace
claude plugin install review-pack@dev-digest-ai
```

## Usage

Ask Claude to "review my changes" or invoke the skill directly with `/review-pack:code-review`.
