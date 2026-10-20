# research-tools

A read-only `researcher` agent that answers one concrete question with
evidence — from the current repository, from official docs and changelogs, or
both — and says plainly what it could not find.

## Install

```bash
claude plugin marketplace add kosyakovr/dev-digest-ai-marketplace
claude plugin install research-tools@dev-digest-ai
```

It is also installed as a dependency of `sdd-engineering`.

## Components

| Type | Name | Invoke as | Purpose |
|---|---|---|---|
| Agent | `researcher` | `research-tools:researcher` | Repo, external or mixed research; returns findings with `path:line` or URL evidence, inferences labelled as such, and a "Not found" table |

## Usage

Ask Claude to delegate a question: "Ask the research-tools:researcher agent which version of zod this repo uses and whether `z.string().email()` changed in it." The agent pins library versions from your manifests before reading docs.

A request with no concrete question, scope or expected output gets a `NEEDS CLARIFICATION` block instead of a guess.

## Inputs

| Input | Required | Default |
|---|---|---|
| question | yes | — |
| scope, expected output, starting paths | no | inferred and stated in the report |

## What runs on your machine

Read-only inspection commands (`git log`, `grep`, `ls`, `npm view …`) and web fetches of the pages it cites. No writes, no hooks, no MCP servers, no credentials. It never reads secret files.
