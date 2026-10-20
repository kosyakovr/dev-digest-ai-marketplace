# Runtime Functions and Hooks

A practical index of the Next.js 16 App Router functions and hooks used most often: where each is
imported from, where it may run, and the version-specific gotchas.

## Navigation hooks (Client Components only, `'use client'`)

| Hook | Import | Returns / use |
| --- | --- | --- |
| `useRouter()` | `next/navigation` | `push`, `replace`, `refresh`, `prefetch`, `back`, `forward` for event handlers |
| `usePathname()` | `next/navigation` | current pathname string (no query) |
| `useSearchParams()` | `next/navigation` | read-only `URLSearchParams` |
| `useParams()` | `next/navigation` | dynamic params of the current URL (`string` or `string[]`) |
| `useSelectedLayoutSegment(slot?)` | `next/navigation` | active segment one level below the calling layout, or `null` |
| `useSelectedLayoutSegments(slot?)` | `next/navigation` | all active segments below the layout (includes route groups) |
| `useLinkStatus()` | `next/link` | `{ pending }` for a `<Link>` ancestor; inline pending hints |

**Do**
- Import `useRouter` from `next/navigation`, never `next/router` (Pages Router only).
- Prefer `<Link>` over `router.push` unless navigation is truly programmatic. Never pass untrusted
  URLs to `push`/`replace` (`javascript:` URLs execute).
- Remember `router.refresh()` only re-renders the current route; it does not invalidate server caches.
- Wrap components using `useSearchParams` in `<Suspense>`: on a prerendered route the build fails
  without one. With Cache Components, `usePathname`, `useParams` and the segment hooks also suspend on
  routes whose params are not covered by `generateStaticParams`, so give them a `<Suspense>` fallback.
- In a page, prefer the `searchParams` / `params` props and pass values down instead of hooks when the
  data drives server fetching.

```tsx
// app/tickets/status-tabs.tsx
'use client'
import Link from 'next/link'
import { useSelectedLayoutSegment } from 'next/navigation'
export function StatusTabs({ statuses }: { statuses: string[] }) {
  const active = useSelectedLayoutSegment() // e.g. 'open' under /tickets/open
  return statuses.map((s) => (
    <Link key={s} href={`/tickets/${s}`} aria-current={s === active ? 'page' : undefined}>{s}</Link>
  ))
}
```

## Control-flow functions (`next/navigation`)

| Function | Server Components | Server Functions | Route Handlers | Client Components |
| --- | --- | --- | --- | --- |
| `redirect(url, type?)` / `permanentRedirect` | yes | yes | yes | during render only, not in handlers |
| `notFound()` | yes | yes | yes | - |
| `forbidden()` / `unauthorized()` (needs `experimental.authInterrupts`) | yes, not root layout | yes | yes | - |

All of them throw; keep them out of `try` blocks or use `unstable_rethrow`. Details:
[error-handling.md](error-handling.md).

## Request APIs (`next/headers`, async)

- `await cookies()`: read in Server Components; `.set`/`.delete` only in Server Functions or Route
  Handlers (cookies cannot be set once streaming starts).
- `await headers()`: read-only request headers.
- `await draftMode()`: `isEnabled`, and `enable()`/`disable()` in a Route Handler.
- With Cache Components, reading them outside `<Suspense>` blocks prerendering, and they are not allowed
  inside `'use cache'` scopes; read outside and pass values in. See [data-patterns.md](data-patterns.md).

## Rendering control and background work

| Function | Import | Purpose |
| --- | --- | --- |
| `connection()` | `next/server` | Wait for a real request; code after it is excluded from prerendering (replaces `unstable_noStore`) |
| `io()` (16.3+) | `next/cache` | With Cache Components, suspend before `Date.now()`, `Math.random()`, sync DB drivers; prefer it over `connection()` because it can still be cached and prefetched. Resolves immediately elsewhere |
| `navigation()` | `next/cache` | Cache Components only (throws otherwise): defer work below it until the user navigates, keeping it out of the App Shell and prefetches |
| `after(cb)` | `next/server` | Run logging/analytics after the response; Server Components, `generateMetadata`, Server Functions, Route Handlers, Proxy |

`after` notes: it does not make a route dynamic; it runs even when the response errored, redirected or
hit `notFound`. In Server Components, read `cookies()`/`headers()` *before* scheduling it and capture the
values; calling them inside the callback throws. In Route Handlers and Server Functions you may call them
inside the callback. Not supported in static export.

```tsx
// app/recipes/[slug]/page.tsx
import { after } from 'next/server'
import { headers } from 'next/headers'
export default async function RecipePage({ params }: PageProps<'/recipes/[slug]'>) {
  const { slug } = await params
  const referrer = (await headers()).get('referer') ?? 'direct'
  after(() => trackView({ slug, referrer })) // values captured before the callback
  return <RecipeDetails slug={slug} />
}
```

## Build-time and metadata exports

- `generateStaticParams()`: pages, layouts and Route Handlers with dynamic segments. With Cache
  Components it must return **at least one** params object (empty array is a build error); in the
  previous model an empty array plus ISR renders paths at runtime.
- `generateMetadata` / `metadata` and `generateViewport` / `viewport`: Server Components only (pages and
  layouts). `fetch` calls inside are memoized with the page's. See [metadata.md](metadata.md).

## `next/server` helpers

- `NextRequest` / `NextResponse`: used in Route Handlers and Proxy; see [route-handlers.md](route-handlers.md).
- `userAgent(request)`: parse `isBot`, `browser`, `device`, `engine`, `os`, `cpu` from a request,
  typically in Proxy or a Route Handler.

## `next/root-params` (16.3+)

Each dynamic segment above the root layout (e.g. `app/[locale]/layout.tsx`) becomes an async getter
(`import { locale } from 'next/root-params'`) callable from any **Server Component** without prop
drilling. Not available in Client Components, Server Actions, Route Handlers or `unstable_cache`.
Callable inside `'use cache'`, where only the getters you use join the cache key. Segment names must be
valid JS identifiers (no `[post-slug]`).

```tsx
// app/[locale]/components/price.tsx
import { locale } from 'next/root-params'
export async function Price({ cents }: { cents: number }) {
  const fmt = new Intl.NumberFormat(await locale(), { style: 'currency', currency: 'EUR' })
  return <span>{fmt.format(cents / 100)}</span>
}
```

Cache-related functions (`cacheLife`, `cacheTag`, `revalidateTag`, `updateTag`, `revalidatePath`,
`refresh`) are covered in [data-patterns.md](data-patterns.md); async `params`/`searchParams` in
[async-patterns.md](async-patterns.md).

## Sources
Official documentation, accessed 2026-10-20 (Next.js 16.4 docs):
- https://nextjs.org/docs/app/api-reference/functions
- https://nextjs.org/docs/app/api-reference/functions/use-router
- https://nextjs.org/docs/app/api-reference/functions/use-pathname
- https://nextjs.org/docs/app/api-reference/functions/use-search-params
- https://nextjs.org/docs/app/api-reference/functions/use-params
- https://nextjs.org/docs/app/api-reference/functions/use-selected-layout-segment
- https://nextjs.org/docs/app/api-reference/functions/use-selected-layout-segments
- https://nextjs.org/docs/app/api-reference/functions/use-link-status
- https://nextjs.org/docs/app/api-reference/functions/redirect
- https://nextjs.org/docs/app/api-reference/functions/not-found
- https://nextjs.org/docs/app/api-reference/functions/forbidden
- https://nextjs.org/docs/app/api-reference/functions/cookies
- https://nextjs.org/docs/app/api-reference/functions/headers
- https://nextjs.org/docs/app/api-reference/functions/draft-mode
- https://nextjs.org/docs/app/api-reference/functions/connection
- https://nextjs.org/docs/app/api-reference/functions/io
- https://nextjs.org/docs/app/api-reference/functions/navigation
- https://nextjs.org/docs/app/api-reference/functions/after
- https://nextjs.org/docs/app/api-reference/functions/generate-static-params
- https://nextjs.org/docs/app/api-reference/functions/generate-metadata
- https://nextjs.org/docs/app/api-reference/functions/generate-viewport
- https://nextjs.org/docs/app/api-reference/functions/userAgent
- https://nextjs.org/docs/app/api-reference/functions/next-root-params
