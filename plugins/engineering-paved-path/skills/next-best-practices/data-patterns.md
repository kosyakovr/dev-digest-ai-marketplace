# Data Patterns

How to read, mutate, cache and revalidate data in a Next.js 16 App Router app, and which primitive fits
which job. Covers both caching modes; Cache Components is the primary path.

## Pick the primitive

| Need | Use | Not |
| --- | --- | --- |
| Read data for UI | async Server Component calling the DB / DAL / upstream API directly | `fetch('/api/...')` to your own Route Handler |
| Mutation from your UI | Server Function (`'use server'`) via `<form action>` or a transition | Route Handler, or a Server Action used to *read* data |
| External clients, webhooks, non-HTML | Route Handler ([route-handlers.md](route-handlers.md)) | Server Action |
| Browser-only data, polling, shared client cache | SWR / TanStack Query in a Client Component | `useEffect` + `fetch` everywhere |

Server Actions are dispatched one at a time per client, so they are a poor fit for reads and cannot be
parallelized with `Promise.all` from the client.

## Fetching on the server

**Do**
- Start independent requests together and await them with `Promise.all` (or `Promise.allSettled` if one
  failure must not sink the rest). Sequential `await`s in one component create a waterfall.
- Keep genuinely dependent requests sequential, but put the dependent part behind `<Suspense>` so the
  shell can stream ([suspense-boundaries.md](suspense-boundaries.md)).
- Fetch where the data is used. `GET` `fetch` calls with the same URL and options are memoized for one
  render pass (not in Route Handlers). For ORM/DB calls wrap the function in React `cache`
  (`export const getShelf = cache(async (id: string) => ...)`); that memoization is per request only.
- To start a request early, call the deduplicated function without `await` (a `preload`) before other
  blocking work.

```tsx
// app/shelves/[id]/page.tsx
import { getShelf, getShelfBooks } from '@/lib/dal/shelves'
export default async function ShelfPage({ params }: PageProps<'/shelves/[id]'>) {
  const { id } = await params
  const [shelf, books] = await Promise.all([getShelf(id), getShelfBooks(id)])
  return <Shelf shelf={shelf} books={books} />
}
```

## Caching with Cache Components (`cacheComponents: true`)

New apps from the recommended `create-next-app` defaults ship with `cacheComponents: true` and
`partialPrefetching: true`; the docs state both become always-on in the next major. Prefer this model.

- Nothing is cached unless you say so. Add `'use cache'` to a data function or component, and pair it
  with `cacheLife(...)` (otherwise the `default` profile applies) and `cacheTag(...)` for invalidation.
- Arguments and captured values become part of the cache key. Read `cookies()`/`headers()` outside the
  cached scope and pass the values in, or use `'use cache: private'`.
- Uncached or runtime data (cookies, headers, searchParams, uncached I/O) must sit inside `<Suspense>`;
  the rest of the route becomes the prerendered static shell (Partial Prerendering).
- Profiles: `seconds`, `minutes`, `hours`, `days`, `weeks`, `max`. `seconds` (or `revalidate: 0`, or
  `expire` under 5 minutes) is too short-lived to be prerendered and becomes a dynamic hole.
- Default `use cache` storage is in-memory per instance; use `'use cache: remote'` for a shared store.
- Route segment `dynamic`, `revalidate`, `fetchCache` are removed in this mode. `unstable_cache` is
  replaced by `'use cache'`.

```ts
// lib/dal/recipes.ts
import { cacheLife, cacheTag } from 'next/cache'
export async function getRecipe(slug: string) {
  'use cache'
  cacheLife('days')
  cacheTag('recipes', `recipe-${slug}`)
  return db.recipe.findUnique({ where: { slug } })
}
```

## Caching without Cache Components (previous model)

For existing apps that have not migrated: `fetch` is not cached by default; opt in per request with
`cache: 'force-cache'`, `next: { revalidate: 3600 }` and `next: { tags: ['recipes'] }`. Route segment
`export const revalidate = 60` / `export const dynamic = 'force-static'` set route-level behavior.
Do not mix `cache: 'no-store'` with a positive `revalidate` on one call; both are ignored.

## Revalidating after a mutation

| API | Where | Effect |
| --- | --- | --- |
| `updateTag(tag)` | Server Actions only | Expires the tag now; the action's re-render waits for fresh data (read-your-own-writes) |
| `revalidateTag(tag, 'max')` | Server Functions, Route Handlers | Stale-while-revalidate; no immediate re-render. Second arg is required (single-arg form deprecated); `{ expire: 0 }` expires immediately |
| `revalidatePath(path, type?)` | Server Functions, Route Handlers | Invalidates a route path; `type` (`'page'`/`'layout'`) is required for patterns like `/recipes/[slug]`; use the rewrite *destination* path |
| `refresh()` | Server Actions only | Re-fetches the current route payload without touching cached data |

Prefer tags over paths. Call revalidation **before** `redirect()`, since `redirect` throws.

```ts
// app/recipes/actions.ts
'use server'
import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/dal/auth'
import { RecipeInput } from '@/lib/schemas'
export async function createRecipe(_prev: { error?: string }, form: FormData) {
  const user = await requireUser() // auth check inside the action
  const parsed = RecipeInput.safeParse(Object.fromEntries(form))
  if (!parsed.success) return { error: 'Please fix the highlighted fields.' }
  const recipe = await db.recipe.create({ data: { ...parsed.data, authorId: user.id } })
  updateTag('recipes')
  redirect(`/recipes/${recipe.slug}`)
}
```

## Client-side data

- Reading server data once in a Client Component: pass an un-awaited promise from a Server Component and
  unwrap it with React `use()` inside `<Suspense>`; no library needed.
- Reach for SWR or TanStack Query when you need a shared browser cache, focus/interval revalidation,
  data from browser-only APIs (geolocation, storage, files), or frequent polling. Seed initial data from
  the server when the first render needs it.

## Data security

**Do**
- Centralize reads in a server-only Data Access Layer (`import 'server-only'`) that checks authorization
  and returns minimal DTOs; only the DAL reads secrets from `process.env`.
- Authenticate, authorize and validate inside **every** Server Action; they are public POST endpoints.
  Accept IDs, not whole records, and re-check ownership against the session.
- Shape action return values to what the UI renders; they are serialized to the client.

**Avoid** passing full DB rows to Client Components, gating access on `searchParams` flags, and
mutating during render (deleting cookies, revalidating) instead of in an action.

See `engineering-paved-path:security`, `engineering-paved-path:zod`, [error-handling.md](error-handling.md).

## Sources
Official documentation, accessed 2026-10-20 (Next.js 16.4 docs):
- https://nextjs.org/docs/app/getting-started/fetching-data
- https://nextjs.org/docs/app/getting-started/mutating-data
- https://nextjs.org/docs/app/getting-started/caching
- https://nextjs.org/docs/app/getting-started/revalidating
- https://nextjs.org/docs/app/guides/caching-without-cache-components
- https://nextjs.org/docs/app/guides/data-security
- https://nextjs.org/docs/app/guides/server-actions
- https://nextjs.org/docs/app/guides/forms
- https://nextjs.org/docs/app/guides/client-side-data-fetching
- https://nextjs.org/docs/app/guides/backend-for-frontend
- https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents
- https://nextjs.org/docs/app/api-reference/functions/revalidateTag
- https://nextjs.org/docs/app/api-reference/functions/updateTag
- https://nextjs.org/docs/app/api-reference/functions/revalidatePath
- https://nextjs.org/docs/app/api-reference/functions/refresh
- https://nextjs.org/docs/app/api-reference/functions/cacheLife
- https://nextjs.org/docs/app/api-reference/functions/cacheTag
- https://nextjs.org/docs/app/api-reference/functions/fetch
- https://nextjs.org/docs/app/api-reference/functions/unstable_cache
