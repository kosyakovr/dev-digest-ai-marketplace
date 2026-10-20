# Directives: 'use client', 'use server', 'use cache'

What each directive means, where it may be written, and the rules it imposes on the code it covers.
For component-boundary design see [rsc-boundaries.md](rsc-boundaries.md).

## Quick reference

| Directive | Defined by | Placement | Effect |
| --- | --- | --- | --- |
| `'use client'` | React | Top of file only, before imports | Exports become client entry points |
| `'use server'` | React | Top of file or top of an async function body | Exposes Server Functions callable from the client |
| `'use cache'` | Next.js | Top of file or top of an async function/component | Caches output keyed by inputs (needs `cacheComponents`) |
| `'use cache: private'` | Next.js | Same as `'use cache'` | Per-request cache that may read cookies/headers/searchParams |
| `'use cache: remote'` | Next.js | Same as `'use cache'` | Stores entries in a remote cache handler shared across instances |

General rules: a directive must be the first statement (comments may precede it), written with single or double
quotes, never backticks. Do not put `'use server'` or `'use cache'` inside a `'use client'` module. Every export
covered by a file-level `'use server'` or `'use cache'` must be `async`.

## 'use client'

- Marks a module boundary, not a single component. It cannot be used inline in a function.
- Only needed on files rendered directly from Server Components; modules they import are client code already.
- Props of exported components must be serializable; Server Functions are the only functions that may cross.

## 'use server'

- Marks Server Functions (Server Actions when used for mutations). It does **not** mark Server Components;
  components are server by default.
- To call one from a Client Component, define it in a file with `'use server'` at the top and import it.
  Inline `'use server'` works inside Server Components, e.g. a closure passed to a form or client prop.
- Arguments arrive from the network: treat them as untrusted, validate them (`engineering-paved-path:zod`),
  and authenticate and authorize inside every function. Return only the fields the UI needs.
- Closed-over values of inline Server Functions are encrypted, but do not rely on that to hide secrets.

```ts
// app/recipes/actions.ts
'use server'
import { z } from 'zod'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'

const Rating = z.object({ recipeId: z.string(), stars: z.number().int().min(1).max(5) })

export async function rateRecipe(input: unknown) {
  const user = await requireUser()
  const { recipeId, stars } = Rating.parse(input)
  await db.rating.upsert({ recipeId, userId: user.id, stars })
  return { ok: true }
}
```

## 'use cache' (Cache Components only)

Requires `cacheComponents: true` in `next.config.ts`. Recommended `create-next-app` defaults already enable it
together with `partialPrefetching: true`; set `partialPrefetching` explicitly to avoid a warning. Cache Components
does not support the `runtime` segment config. Without the flag, use the previous model (`fetch` cache options,
route segment config) instead.

**Do**
- Choose the scope deliberately: inside a data function caches that result; inside a component caches its
  render; at the top of a `page`/`layout` file caches that segment (each segment is cached independently).
- Call `cacheLife()` explicitly in every cached scope, and `cacheTag()` when you will invalidate on demand.
  Both must run inside a `use cache` / `use cache: private` scope, or they throw.
- Read `cookies()`, `headers()`, `searchParams` outside the cached function and pass plain values in.
- Pass `children`, JSX slots, or Server Functions through a cached component without inspecting them;
  they do not affect the cache key.

**Avoid**
- Calling `cookies()`, `headers()`, `searchParams`, or `connection()` inside `use cache`, including in helpers it
  calls (error `next-request-in-use-cache`; on dynamic routes it may only surface under `next start`).
- Passing unresolved request promises into a cached function or sharing promises via a module-level `Map`;
  the build can hang until the 50-second cache-fill timeout.
- Class instances, `URL` objects, or non-pass-through functions as arguments.
- Nesting a short-lived cache (e.g. `cacheLife('seconds')`) inside a `use cache` that has no explicit `cacheLife`;
  this fails during prerendering.
- Relying on `React.cache` to feed data into a cached scope; it is isolated there. Use arguments.

```ts
// lib/bookshelf.ts
import { cacheLife, cacheTag } from 'next/cache'
import { db } from '@/lib/db'

export async function getShelf(shelfId: string) {
  'use cache'
  cacheLife('hours')
  cacheTag(`shelf-${shelfId}`) // invalidate later with updateTag/revalidateTag
  return db.book.findMany({ where: { shelfId }, orderBy: { title: 'asc' } }) // shelfId keys the entry
}
```

Serialization: the cache key includes the build ID, a function ID, serialized arguments, and any captured
closure variables. Arguments follow the stricter Server Function rules (JSX only as pass-through); return values
follow Client Component prop rules, so returning JSX is fine.

`draftMode().isEnabled` may be read inside a cached scope; when Draft Mode is on, cached functions re-run on every
request without saving results. Toggling Draft Mode inside a cached scope throws.

## 'use cache: private' and 'use cache: remote'

- `private`: may read `cookies()`, `headers()`, `searchParams` (still not `connection()`). Results are not stored
  in a server cache across production requests and are excluded from the static shell. Reach for it only when
  passing runtime values as arguments is impractical or compliance requires it. No custom cache handler.
- `remote`: stores entries via a configured `cacheHandlers` handler, shared across instances. Worth it for
  request-time content backed by rate-limited, slow, or expensive sources; key on low-cardinality values
  (category, language) rather than per-user ids. Costs storage and a network lookup.
- Nesting: remote inside remote or inside `use cache` is fine; remote inside private, or private inside remote,
  is an error. No `use cache` variant survives a new deploy (the build or `deploymentId` is part of the key).

## Sources
Official documentation, accessed 2026-10-20 (Next.js 16.4 docs):
- https://nextjs.org/docs/app/api-reference/directives
- https://nextjs.org/docs/app/api-reference/directives/use-client
- https://nextjs.org/docs/app/api-reference/directives/use-server
- https://nextjs.org/docs/app/api-reference/directives/use-cache
- https://nextjs.org/docs/app/api-reference/directives/use-cache-private
- https://nextjs.org/docs/app/api-reference/directives/use-cache-remote
- https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents
- https://nextjs.org/docs/app/api-reference/functions/cacheLife
- https://nextjs.org/docs/app/getting-started/caching
- https://nextjs.org/docs/app/guides/data-security
- https://nextjs.org/docs/messages/cache-life-outside-use-cache
- https://nextjs.org/docs/messages/cache-tag-outside-use-cache
- https://nextjs.org/docs/messages/next-request-in-use-cache
- https://react.dev/reference/rsc/use-client
- https://react.dev/reference/rsc/use-server
