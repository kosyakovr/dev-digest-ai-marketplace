---
name: skill-routing
description: >-
  Maps files and technologies to the engineering-paved-path skills and the
  sections that govern them, in groups A–F (backend architecture, backend data,
  frontend architecture, frontend React, security, generic). Use when planning,
  implementing or reviewing a change to decide which paved-path skills to load
  and which sections to cite.
user-invocable: false
---

# Skill routing — files and technologies to paved-path skills

Input: changed or planned paths (`git diff --name-status -M <base> HEAD`, or a
plan's file list). Output: every path as **excluded**, **routed** or **unrouted**,
and for each routed group the skills to load and the sections to apply.

## How to match

- **Detect by signal, not by path.** A signal is what the file *is* or *imports*:
  an `import ... from 'fastify'`, a `pgTable(` call, a `.sql` migration, a
  `"use client"` directive. Folder names are only a hint.
- **The project's architecture docs win.** When `ARCHITECTURE.md`, `docs/adr/**`,
  `docs/architecture/**` or the architecture section of `CLAUDE.md`/`AGENTS.md`
  maps paths to layers or modules explicitly, use that mapping over the signals
  below, and say which doc you used.
- **A path may join more than one group.** A Drizzle repository is both A and B;
  a route handler that reads a session cookie is both A and E.
- **A group applies only if it matched at least one non-excluded path.** A path
  that matches no group goes to F and is also listed as *unrouted*.
- Load each skill with the Skill tool by its namespaced name
  (`engineering-paved-path:onion-architecture`).

## Excluded — list them, never review them

| Kind | Examples |
|---|---|
| Lock files | `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`, `*.lock` |
| Generated files | `*.generated.*`, `*.gen.ts`, generated API clients, `*.snap`, `*.d.ts` emitted by a build, ORM-generated migration snapshots/journals |
| Vendored third-party code | `vendor/**`, `third_party/**`, copied design-system packages the project does not author |
| Build output and artifacts | `dist/`, `build/`, `out/`, `.next/`, `coverage/`, `node_modules/`, test-run reports |

Excluding a file only keeps it out of review; whether it may be *edited* is decided
by the caller's protected paths. Mention excluded files in the summary.

## Groups

### A · backend-architecture

- **Signals:** server code that imports `fastify`/`@fastify/*` (or another HTTP
  framework); files that act as routes/handlers, services/use cases, repositories,
  adapters, ports, a composition root or DI container, config or error modules;
  backend module folders (`modules/<name>/`, `services/`, `repositories/`,
  `adapters/`).
- **Skills:** `onion-architecture`; add `fastify-best-practices` when the file
  imports Fastify; add `zod` when it declares request/response schemas.
- **Cite:** `onion-architecture` §1 rings, §3 placement, §4 dependency direction,
  §5 ports, §6 boundary and composition root, §7 ORM at the edge, §8 parsing at the
  perimeter, §9 tests, §10 anti-patterns, §11 recorded exceptions, §12 overkill.
  `fastify-best-practices` by topic file: `rules/plugins.md`, `rules/routes.md`,
  `rules/schemas.md`, `rules/hooks.md`, `rules/error-handling.md`,
  `rules/testing.md`, `rules/typescript.md`.
- For a backend that is not Fastify + Drizzle, apply `onion-architecture` by
  analogy: §1, §4, §5, §8, §9, §10 and §12 carry over; §6, §7 and the §13 greps
  name Fastify and Drizzle and apply only where an equivalent exists.

### B · backend-data

- **Signals:** imports of `drizzle-orm` or `drizzle-kit`; `pgTable(`/`mysqlTable(`/
  `sqliteTable(` schema files; `drizzle.config.*`; repositories that build
  queries; `.sql` migrations or `CREATE TABLE`/`ALTER TABLE`/`CREATE INDEX`;
  shared Zod contracts and DTO schemas.
- **Skills:** Drizzle code → `drizzle-orm-patterns` + `postgresql-table-design`
  (when the dialect is Postgres); SQL migrations → `postgresql-table-design`;
  `zod` imports → `zod`.
- **Cite:** `drizzle-orm-patterns` › Best Practices, Constraints and Warnings, and
  `references/{schema-definition,relations,queries-joins-aggregations,transactions,migrations}.md`.
  `postgresql-table-design` › Core Rules, Data Types, Constraints, Indexing, Safe
  Schema Evolution. `zod` §1–§8 Quick Reference categories (§2 Parsing, §3 Type
  Inference, §5 Object Schemas) and the rule file by slug, e.g.
  `references/parse-validate-early.md`. Query and row-type placement: `onion-architecture` §7.

### C · frontend-architecture

- **Signals:** any new, moved or renamed frontend file (`*.ts`/`*.tsx` that imports
  `react`, `next/*`, or lives in a client package); barrels (`index.ts`
  re-exports), path aliases, `constants.ts`/`helpers.ts`/`types.ts` next to UI;
  Next.js `app/` or `pages/` with `next.config.*` present.
- **Skills:** `frontend-ui-architecture`; add `next-best-practices` when the
  project has `next.config.*` and the file is under `app/` or `pages/`, is a
  `route.ts`, `middleware.ts`/`proxy.ts`, or uses `"use client"`/`"use server"`.
- **Cite:** `frontend-ui-architecture` §1 placement, §2 promotion, §3 component
  folder, §4 splitting, §5 constants, §6 no `utils/`, §7 business logic, §8 state,
  §9 types, §10 imports, §11 barrels, §12 App Router, §13 anti-patterns.
  `next-best-practices` by topic file (`SKILL.md` for the overview): `file-conventions`,
  `rsc-boundaries`, `directives`, `data-patterns`, `async-patterns`, `route-handlers`,
  `error-handling`, `suspense-boundaries`, `hydration-error`, `metadata`, `image`,
  `font`, `scripts`, `bundling`, `runtime-selection`, `parallel-routes`,
  `functions`, `self-hosting`, `debug-tricks` (each `<topic>.md`).

### D · frontend-react

- **Signals:** `*.tsx`/`*.jsx` React components; custom hooks (`use*` functions,
  `lib/hooks/**`); React tests (`*.test.tsx`/`*.test.jsx`, imports of
  `@testing-library/react`).
- **Skills:** `react-best-practices`; add `react-testing-library` for React tests.
- **Cite:** `react-best-practices` §1 component design, §2 derive don't store,
  §3 state, §4 hooks, §5 render factories, §7 over-engineering, §8 data fetching,
  §10 error boundaries, §11 keys, §12 conditional rendering, §13 accessibility
  (severity is in each heading). `react-testing-library` › Query Priority, Async
  Testing, Mocking Strategies, What to Test / What to Skip, Anti-Patterns. File
  placement and component size: `frontend-ui-architecture` wins over
  `react-best-practices` §1 and §17.

### E · security

- **Signals:** authentication, sessions, tokens, authorization or ownership checks;
  handling of request input (bodies, params, query strings, headers, cookies,
  webhooks); secrets, `process.env`, config; file uploads and filesystem paths
  built from input; SQL or NoSQL built from input; HTML rendering
  (`dangerouslySetInnerHTML`, markdown to HTML, `href`/`src` from data); `exec(`,
  `spawn(`, `eval`; CORS, security headers, rate limiting; logging of request data;
  LLM prompts or output; CI workflows; a secret-shaped literal anywhere.
- **Skills:** `security`.
- **Cite:** `security` §1 confidence rules, §3–§12 OWASP A01–A10, §13 file
  uploads, §14 secret detection, §15 agentic AI, §16 framework quirks, §17 review
  process, §18 severity.
- Its examples assume Express + MongoDB + JWT. Apply the categories and confidence
  rules to the project's stack; if you cannot name the missing equivalent in that
  stack, you do not have a finding.

### F · generic

- **Signals:** everything else, and in addition to any group above: any
  TypeScript file; Markdown docs, specs, ADRs and READMEs; scripts; package
  manifests and tool config.
- **Skills:** `typescript-expert` for `*.ts`/`*.tsx`/`tsconfig*.json`;
  `mermaid-diagram` for docs with (or needing) a ```` ```mermaid ```` block.
- **Cite:** `typescript-expert` › Code Review Checklist (Type Safety, Module
  System, Error Handling Patterns), Strict by Default. `mermaid-diagram` › Diagram
  Type Decision Guide, Best Practices, Validation.
- `typescript-expert` is guidance, not a rule catalogue: a finding needs a concrete
  defect (broken contract, unsound type, nullability regression), not a preference.

## How to cite

Cite a rule as `engineering-paved-path:<skill> §n` (`engineering-paved-path:onion-architecture §4`).
Without numbered sections, cite the topic file or heading
(`engineering-paved-path:fastify-best-practices rules/hooks.md`,
`engineering-paved-path:postgresql-table-design › Indexing`). Cite; do not restate.
