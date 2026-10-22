# engineering-paved-path

The shared source of technical skills for the paved path: how code is
structured, written and tested in a TypeScript stack built on React, Next.js,
Fastify, Drizzle and PostgreSQL. Claude loads them on demand; the
`sdd-engineering` and `architecture-review` agents load them by namespace and
cite their sections in plans, code and reviews.

## Install

```bash
claude plugin marketplace add kosyakovr/dev-digest-ai-marketplace
claude plugin install engineering-paved-path@dev-digest-ai
```

These commands use the stable channel. For the latest channel, or to switch between the two, see [Install](../../README.md#install) in the marketplace README.

It is also installed as a dependency of `architecture-review` and `sdd-engineering`.

## Skills

| Area | Skill | Covers |
|---|---|---|
| React | `react-best-practices` | Component design, derived state, hooks, data fetching, keys, accessibility (§1–§17) |
| Testing | `react-testing-library` | React Testing Library with Vitest: query priority, async tests, mocking, what to test |
| Next.js | `next-best-practices` | Next.js 16 App Router: file conventions, RSC boundaries, caching, route handlers, metadata, images, fonts, self-hosting |
| Fastify | `fastify-best-practices` | Plugins, routes, schemas, hooks, errors, logging, testing with `inject` (`rules/*.md`) |
| Architecture | `onion-architecture` | Backend rings, module anatomy, dependency direction, ports and adapters (§1–§13) |
| Architecture | `frontend-ui-architecture` | Frontend file placement, component promotion, state and logic placement, imports, barrels (§1–§15) |
| Drizzle | `drizzle-orm-patterns` | Schema, relations, queries, transactions, migrations |
| PostgreSQL | `postgresql-table-design` | Data types, constraints, indexing, safe schema evolution |
| Zod | `zod` | Schemas, parsing, errors, type inference (43 rule files) |
| TypeScript | `typescript-expert` | Type-level programming, strictness, tooling, migration; a read-only diagnostic script |
| Security | `security` | OWASP Top 10:2025, uploads, secrets, agentic AI security (§1–§19) |
| Mermaid | `mermaid-diagram` | Flowcharts, sequence, ER, state and other diagrams in Markdown |
| Routing | `skill-routing` | Which skill and sections govern a given file or technology (groups A–F); used by agents, hidden from the `/` menu |

Invoke any of them directly as `/engineering-paved-path:<skill>`, or let Claude pick them up from the task. Agents cite rules as `engineering-paved-path:<skill> §n`.

## Adapting to your project

The skills describe a default; your repository's architecture docs win. When `ARCHITECTURE.md`, `docs/architecture/**`, `docs/adr/**` or the architecture section of `CLAUDE.md` / `AGENTS.md` map paths to layers or record exceptions, `skill-routing` and the reviewers use that mapping over the skills' generic signals.

## What runs on your machine

`typescript-expert/scripts/ts_diagnostic.py` (python3) runs the project's own `node_modules/typescript/bin/tsc --noEmit` and scans for `any` / `as` casts. It writes no files and makes no network calls; it runs only when you or Claude invoke it. No hooks, no MCP servers, no credentials.

## Provenance

Most skills were adapted from open-source skill collections; `next-best-practices` and `skill-routing` were written for this plugin. Origins and licenses: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
