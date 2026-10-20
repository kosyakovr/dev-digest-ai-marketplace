---
name: onion-architecture
description: >-
  Onion / ports-and-adapters layering for a Node.js + TypeScript backend
  (Fastify, Drizzle, Zod): which ring a file belongs to, which way dependencies
  point, when to add a port, how the composition root wires it. Use before
  adding a backend file, module, route, service, repository or adapter, when a
  handler queries the database, when ORM row types leak upward, when reviewing
  backend structure, or when asked "where should this logic live".
---

# Onion architecture — backend layering

Layering and boundaries only. Sources and the reasoning behind every contested
call are in [README.md](README.md); bad/good pairs are in [examples.md](examples.md).

**Not this skill's job:** Fastify route/plugin/hook syntax →
`engineering-paved-path:fastify-best-practices`. Query building, relations,
schema syntax → `engineering-paved-path:drizzle-orm-patterns`. Schema authoring →
`engineering-paved-path:zod`. Table design, indexes, types →
`engineering-paved-path:postgresql-table-design`. This skill only says *which
layer* each of those belongs in.

The canonical sources disagree on how many rings there should be — Cockburn has
two, Palermo four, Three Dots Labs caps it at three or four. They agree on
exactly one thing: **the direction of dependencies**. So that is what this skill
enforces. It does not invent new rings, and it does not rename the folders a
project already has.

**Paths in this skill are a reference layout** (`src/modules/<name>/`,
`src/shared/`, `src/db/`, `src/adapters/`, `src/platform/`). Map them onto the
project's own folder names. When the project's architecture docs or ADRs map
paths to layers explicitly, those docs win.

**Scope of enforcement:** these rules are mandatory for **new** files and new
modules. Recorded exceptions (§11) stay as they are — do not refactor them
because you happened to open the file. Fix one only when the task is to fix it.

## 1. The rings, mapped onto a project

Onion's rings usually exist already under different names. Use the project's names.

| Ring | Lives in (reference layout) | May import |
|---|---|---|
| ① Domain model + ports | `src/shared/` (contracts, domain types, port interfaces) | the schema library (`zod`), and nothing else |
| ② Use cases | `src/modules/<name>/{service,helpers}.ts` | ①, own `repository.ts`, `platform/errors`, pure logging helpers, ports via the composition root |
| ③ Infrastructure | `src/db/`, `src/adapters/`, `src/modules/<name>/repository.ts` | ①, ②, and the real libraries (`drizzle-orm`, HTTP SDKs, LLM clients, …) |
| ④ Boundary + composition | `src/modules/<name>/routes.ts`, `src/app.ts`, `src/platform/container.ts` | everything |

Two things this table is saying that are easy to miss:

- **Ring ③ is on the outside, not the bottom.** Palermo's sharpest line is that
  "data access is a top layer". The database is a detail the core is protected
  *from*, not a foundation it is built *on*.
- **`src/platform/` is not a ring.** It is cross-cutting infrastructure
  (`config`, `errors`, `jobs`, `sse`, `container`). `errors.ts` is safe to
  import from anywhere; so are pure helpers that shape log payloads onto a
  logger they are handed (no I/O of their own, so routing them through the
  container would be ceremony); `container.ts` belongs to ④ and must never be
  imported by a repository.

A core package whose only dependencies are the schema library and injected
ports (for example an `LLMProvider` interface) is what ring ① looks like when it
is taken seriously: it runs with no database, no HTTP server and no filesystem.
That is the standard to aim at.

## 2. Anatomy of a module

A module is a vertical slice with the rings *inside* it. Pick the project's
cleanest existing module as the canonical shape and copy it.

```
modules/<name>/
├── routes.ts       ④ Fastify plugin, default export. The ONLY file importing fastify.
├── service.ts      ② use cases. No HTTP, no SQL.
├── repository.ts   ③ the ONLY file touching this module's tables.
├── helpers.ts      ② pure functions: parsing, mapping, formatting. No I/O.
├── constants.ts    — literals: job kinds, regexes, secret names, limits.
└── types.ts        — only when the module exposes a port to other modules.
```

Rules:

- **Do not create empty files.** A module that is one read query is
  `routes.ts` + `repository.ts`. Add `service.ts` when there is a decision to
  make, `constants.ts` when there is a literal to name. See §12.
- **Open every file with a docblock that names its layer and its prohibition.**
  It is the cheapest enforcement mechanism there is — `repository.ts` says "the
  ONLY place that touches the `orders` table", `helpers.ts` says "Pure functions
  only — no I/O, no DB, no container", `service.ts` says "No HTTP and no raw SQL
  live here".
- **Register the module** in one place (for example `src/modules/index.ts`):
  one import, one entry. Prefer static registration: dynamic `import()` of `.ts`
  files (as `@fastify/autoload` does) is not portable across tsx, tsc and vitest.
- A module over ~400 lines in one file splits by ring, not by size — peel a
  long-running executor off the service, or turn `repository.ts` into a facade
  over `repository/*.repo.ts`.

## 3. Where does this code go?

| The code is… | It goes in | Example |
|---|---|---|
| An HTTP route | `modules/<name>/routes.ts` | `modules/orders/routes.ts` |
| A wire contract (request/response shape) | `shared/contracts/` | `contracts/orders.ts` |
| An interface for anything outside the process | `shared/ports.ts` | `LLMProvider`, `PaymentGateway` |
| A business decision, orchestration, a workflow | `modules/<name>/service.ts` | `OrderService.place` |
| A long-running background step | its own file in the module | `modules/reports/report-runner.ts` |
| A SQL query | `modules/<name>/repository.ts` | `OrderRepository.findByNumber` |
| A table definition | `src/db/schema/<domain>.ts` | `db/schema/orders.ts` |
| A row type shared across modules | `src/db/rows.ts` | `OrderRow`, `CustomerRow` |
| A row → DTO mapper | `modules/<name>/helpers.ts` | `toOrderDto` |
| A pure transform with no I/O | `modules/<name>/helpers.ts` | `parseOrderNumber` |
| A literal (job kind, regex, limit, secret name) | `modules/<name>/constants.ts` | `EXPORT_JOB_KIND` |
| A call to a third-party library or binary | `src/adapters/<tech>/` | `adapters/stripe/client.ts` |
| A test double for a port | `src/adapters/mocks.ts` | `MockPaymentGateway` |
| Env-derived configuration | `src/platform/config.ts` | `AppConfig` |
| A secret | never in config — `SecretsProvider` | `adapters/secrets/env.ts` |
| An error type | `src/platform/errors.ts` | `NotFoundError` |
| Cross-cutting runtime machinery | `src/platform/` | `jobs.ts`, `sse.ts` |
| A facade one module exposes to others | `modules/<name>/types.ts` + `Container` | `OrderLookup` |
| Wiring of any kind | `src/platform/container.ts` or `src/app.ts` | — |
| A test needing a real database | `test/<name>.it.test.ts` | — |
| Any other test | `test/<name>.test.ts` | — |

If two rows seem to fit, pick the **inner** one. Code earns its way outward.

## 4. Direction of dependencies

```
routes.ts  →  service.ts  →  repository.ts  →  db/
    ↓            ↓
 contracts    ports (via container)  →  adapters/
```

Everything points one way, inward and downward. Concretely:

- **`service.ts` must not import `fastify`.** Not the app, not `FastifyRequest`,
  not a reply type. If a use case needs the HTTP status, it throws an `AppError`
  and lets the one error translator (registered in `app.ts`) translate it.
- **`service.ts` must not import `drizzle-orm`** or `db/schema`. Persistence is
  the repository's job.
- **`repository.ts` must not import `Container`,** a service, or another
  module's repository.
- **`helpers.ts` does no I/O.** No `await`, no `db`, no `container`, no `fetch`.
- **A module never reaches into another module's folder.** Cross-module access
  goes through `container.*` — that is exactly why shared repositories and
  module facades are constructed in the composition root.
- **An outer ring may call any inner ring directly**, not only the one next to
  it. A route that only reads may call the repository without inventing a
  pass-through service (§12). This is Onion, not strict layering — do not
  over-restrict here.

What may *not* flow inward is just as important: no Fastify types, no Drizzle
types, no `process.env`, no third-party SDK imports in rings ① and ②.

## 5. Ports and adapters

A port is an interface owned by the inside, implemented by the outside. Write
the rule at the top of the ports file: *"ALL external calls go behind these
interfaces. Services depend on the interface, not the impl."*

**Introduce a port when** the thing is outside the process — network, disk,
subprocess, clock, randomness — or when a test would otherwise need
infrastructure to run. **Do not introduce a port** for a single implementation
that lives entirely inside one ring. An interface with one implementation and no
boundary to protect is ceremony.

Name a port after the *conversation*, not the technology: `GitHubClient`, not
`OctokitWrapper`; `CodeIndex`, not `RipgrepRunner`.

Three places a port can be declared — pick by blast radius:

| Reach | Declare in | Example |
|---|---|---|
| Used by several modules | `shared/ports.ts` | `LLMProvider`, `GitClient` |
| One module's public facade | `modules/<name>/types.ts` | `OrderLookup` |
| One narrow technical concern | `adapters/<tech>/index.ts` | `DepGraph`, `Tokenizer` |

Every port needs three things, and all three are required to land together:

1. A real implementation in `src/adapters/<tech>/`.
2. A lazy getter on the composition root (`Container`) plus a field on its
   test-override type (`ContainerOverrides`).
3. A double in the shared test-doubles module (`src/adapters/mocks.ts`),
   declared `implements` so the compiler keeps it honest.

A port that cannot be overridden in tests is not a port.

## 6. Fastify is the boundary, and the composition root

**The handler parses, delegates, and maps the result. Nothing else.** A handful
of lines per endpoint is the target density. Business logic in a handler is the
single most common violation.

- **Validate with a schema, never with `Schema.parse()` in the handler.** Routes
  opt in with `app.withTypeProvider<ZodTypeProvider>()` and declare
  `{ schema: { body, params, querystring, response } }`. The request type is
  then *inferred*, not asserted, and the response is serialized by the same
  contract.
- **Never set an error status by hand.** Throw `NotFoundError`, `ValidationError`,
  `ExternalServiceError` or `AppError` from `platform/errors.ts`. The one
  translator lives in `app.ts` (validation → 422, `AppError` → its own status).
  Success statuses are the handler's business: `reply.status(created ? 201 : 200)`.
- **Tenancy is resolved at the boundary.** In a multi-tenant system, resolve the
  tenant in the handler (for example `getContext(container, req)`) and pass
  `tenantId` down as a parameter. Services take `tenantId: string`; they do not
  take a request.
- **Order in `app.ts` is load-bearing:** type-provider compilers → `Container` →
  decorate → ecosystem plugins (helmet, cors, sse, rate-limit) → health → error
  handler → modules. Modules are encapsulated child contexts, so anything they
  must inherit has to be registered before them.
- **The plugin tree is the composition root.** `Container` is built once in
  `app.ts` and decorated onto the instance; nothing else constructs an adapter.
  A `new StripeClient(...)` outside `container.ts` is a bug.

Whether services take the whole `Container` or individual ports is a coarse vs
precise seam trade-off — see README → Contested. Follow the project's existing
choice for consistency; do not introduce a DI library.

## 7. Drizzle stays at the edge

The reason for a repository is **not** that Postgres might be swapped out.
It will not be. The reason is **type containment**: keeping generated row shapes
out of the signatures your use cases are written against.

- **`drizzle-orm` and `db/schema` are importable from `repository.ts` and `db/`
  only.** Not from a service, not from a route.
- **Never expose a Drizzle type above the repository.** No `Db`, no `SQL<T>`, no
  `PgTable`, no bare `$inferSelect` in a signature a service or route reads.
  A row type re-exported by name (`export type OrderRow = typeof t.orders.$inferSelect`)
  is the accepted local form; mapping to the DTO happens in `helpers.ts`.
- **Three type families, and they are not interchangeable:** DB row
  (`$inferSelect`), domain type, wire DTO (`shared/contracts`). The
  repository owns row→domain; `helpers.ts` owns domain→DTO. A route returning a
  row directly has skipped both.
- **Write mappers by hand, field by field.** No spreading a row into a DTO —
  divergence between the table and the contract must be visible in the diff, and
  a spread silently leaks new columns to the API the day they are added.
- **Name methods after the business operation**, not the query:
  `findByNumber` reads fine, `selectWhereTenantIdAndNumber` does not.
- **Transactions belong to the service.** It knows the business operation's
  extent. Repository methods accept an optional transaction handle.
- **In a multi-tenant system every query is scoped by the tenant key.** This is
  a tenancy guard, not a filter; a query without it is a security bug.
- **One repository style: a class holding `this.db`,** constructed as
  `new XRepository(container.db)`. If an older style (free functions taking `db`
  as the first argument) exists, keep it behind a facade class. New code uses
  the class.

## 8. Zod at the perimeter

Parse at the edge; trust the types inside.

- **Parse everything entering the process:** request bodies, params, query
  strings, env vars, third-party API and LLM responses, job payloads, anything
  out of `JSON.parse`. Inside, a typed value is already proven.
- **Do not re-validate in the core.** If a service feels the need to re-parse its
  own input, the boundary is in the wrong place.
- **The schema is the source of truth; derive the type with `z.infer`.** Never
  hand-write an interface next to a schema.
- **A contract is a wire format, not a domain model.** If DTOs use a different
  naming convention from the domain and DB (for example `snake_case` on the wire,
  `camelCase` inside), do not let one bleed into the other — the mapper exists
  for this.
- **Mind `z.input` vs `z.output`.** Once a schema has a `.transform()` or a
  `.default()`, the two differ, and a DTO typed with the wrong one will lie.
  Also note `.parse()` returns a deep clone, so it is not free on hot paths.
- **If the contracts module is shared or vendored** between server and client,
  changing a contract means changing every copy in the same commit.

## 9. Tests follow the rings

The mechanical test of whether the architecture is real:
**a use case must be callable without starting Fastify and without a database.**
If it is not, the layering is broken — the test is only the messenger.

| Subject | How | Naming |
|---|---|---|
| `helpers.ts` | plain unit test, no setup | `test/<name>.test.ts` |
| `service.ts` | `Container` with `ContainerOverrides` from `mocks.ts` | `test/<name>.test.ts` |
| `repository.ts`, adapters | real Postgres via testcontainers | `test/<name>.it.test.ts` |
| routes | `app.inject()` with mock overrides | either, per what it touches |

- **Follow the project's suffix for database-backed tests** (for example
  `.it.test.ts`) — CI often splits the suites on that name.
- **Prefer fakes over mocks.** `mocks.ts` holds working in-memory
  implementations, not assertion spies. Verify the outcome, not the call.
- And the counterweight, because this is a real failure mode: heavy mocking is a
  symptom, not a virtue. If testing one use case needs five configured doubles,
  the use case is doing five things.

## 10. Anti-patterns

| Symptom | Fix |
|---|---|
| `import { eq } from 'drizzle-orm'` in `routes.ts` | move the query to a repository (§7) |
| `db.select()` in a handler | repository, called by the route or a service (§4) |
| `FastifyRequest` in a service signature | pass `tenantId` and the parsed body (§6) |
| `Schema.parse(req.body)` in a handler | declare it in `{ schema: { body } }` (§6) |
| `reply.status(404)` for a missing row | `throw new NotFoundError(...)` (§6) |
| `$inferSelect` in a service or route signature | map to a domain type or DTO (§7) |
| `return row` from a route | `toXDto(row)` in `helpers.ts` (§7) |
| `{ ...row }` as a DTO | hand-written field mapping (§7) |
| `new StripeClient()` outside `container.ts` | a port plus a container getter (§5) |
| `process.env` outside `config.ts` / `secrets/` | `AppConfig` or `SecretsProvider` (§3) |
| A query without the tenant key | add the tenancy guard (§7) |
| `import '../other-module/repository.js'` | expose it on `Container` (§4) |
| A new port with no entry in `mocks.ts` | add the double before merging (§5) |
| A service test that needs Docker | inject `ContainerOverrides` (§9) |
| An interface with one impl and no boundary | delete it, use the class (§5) |
| A service that only forwards to a repository | let the route call the repository (§12) |
| The same external call written in two modules | one service, reached via the container (§4) |

## 11. Known exceptions

Exceptions are the ones recorded in the project's architecture docs or ADRs.
They stay as they are: new code does not copy them, and existing files are not
rewritten in passing. A violation that is not recorded anywhere is not an
exception — report it, do not copy it.

One pattern is accepted by design rather than as an exception: **the composition
root (`container.ts`) may import from `modules/`** to construct shared
repositories and module facades. That is what keeps modules from importing each
other directly. Do not "fix" it.

When an exception is recorded, record its scope too (for example "pure functions
only" or "constants only, no behaviour"), so it cannot quietly widen.

## 12. When the full shape is overkill

Three or four rings is the ceiling; six is a smell. A module is not obliged to
have every file.

- **A read-only endpoint over one table** is fine as `routes.ts` +
  `repository.ts`. Do not add a service that only forwards calls — a
  pass-through layer is cost with no benefit.
- **A module with no external dependency** needs no port.
- **Add the layer when the second reason appears:** a second caller, a
  background job, a branch in the logic, a transaction spanning two tables.
- The signal that you went too far: explaining where a change goes takes longer
  than making it.

## 13. Enforcement

Without a linter rule, `tsc --noEmit` and the test runner are the only machine
checks. These greps work with the reference layout, run from the backend
package root (adjust the paths to the project's own):

```bash
grep -rn "drizzle-orm" src/modules/*/routes.ts                  # DB in the boundary
grep -rn "from 'fastify" src/modules/*/service.ts               # framework in a use case
grep -rn '\$inferSelect' src/modules/*/service.ts               # row types leaking up
grep -rn "from '\.\./[a-z-]*/repository" src/modules --include='*.ts'  # cross-module reach
grep -rn 'process\.env' src --include='*.ts' \
  | grep -v 'platform/config\|adapters/secrets'                 # config bypass
grep -rL 'tenantId' src/modules/*/repository.ts                 # tenancy guard (heuristic)
```

Expected: nothing, except hits that match a recorded exception (§11). The last
two checks are heuristics, not rules — standalone scripts with no `AppConfig`
and code that *sets* env vars for a subprocess are common false positives, and a
repository may be scoped by an id the caller already resolved inside a tenant.
Read the hit before calling it a violation.

To review a change, run each pattern with `git grep` at **both `HEAD` and the
merge-base** and report only the difference: new hits surface, grandfathered
hits cancel mechanically, and no baseline needs hand-maintaining.

Stronger enforcement is possible but **ask the user before adding anything** —
new dependencies change lock files.

- `dependency-cruiser` expresses layer rules as path-regex `forbidden` rules in a
  config file. If it is already a dependency, this is the cheapest real upgrade.
- `eslint-plugin-boundaries` gives in-editor feedback, `ArchUnitTS` expresses the
  rules as Vitest assertions. Both need new dependencies.
