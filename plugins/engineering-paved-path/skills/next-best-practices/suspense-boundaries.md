# Suspense Boundaries and Streaming

Where to put `loading.js` and `<Suspense>`, what forces a boundary in Next.js 16, and how to design fallbacks
that keep the page fast. Assumes Cache Components is the primary model (on by default in new `create-next-app`
projects); differences for the previous model are called out.

## How it works

- Everything that renders before any async work resolves is the **static shell**: layouts, static markup,
  and Suspense fallbacks. It is sent first; each `<Suspense>` boundary then streams in independently.
- `loading.tsx` in a folder wraps that segment's `page` (and nested layouts, `not-found`) in one `<Suspense>`.
  It does **not** wrap the `layout`, `template`, or `error` of the same segment.
- `<Suspense>` only provides a fallback; it does not make sync work dynamic. A component doing only
  synchronous work completes during prerendering either way.

## What requires a boundary

With `cacheComponents: true`, each of these must sit under a `<Suspense>` (or be cached). Otherwise the dev
overlay flags a blocking route, and accesses that stop prerendering fail `next build`:

| Access | Fix options |
| --- | --- |
| Uncached `fetch`, DB call, `await connection()` | Wrap in `<Suspense>`, or cache with `use cache` |
| `cookies()`, `headers()`, `searchParams`, non-prerendered `params` | Wrap in `<Suspense>`, pass values to a cached function, or `use cache: private` |
| `useSearchParams()` in a Client Component (any prerendered route) | Wrap the hook's component in `<Suspense>` |
| `usePathname`, `useParams`, `useSelectedLayoutSegment(s)` on routes with request-time dynamic params | Wrap in `<Suspense>` |

As a last resort, `export const instant = false` on a page or layout (Cache Components only, Server files only)
accepts that navigation to that segment blocks. Use `next build --debug-prerender` to locate the component.

Previous model (no Cache Components): `useSearchParams()` without a boundary makes the whole page client-render
up to the nearest boundary ("Missing Suspense boundary with useSearchParams"); runtime APIs make the route dynamic
rather than erroring.

## Placement rules

**Do**
- Push the boundary as low as possible while keeping the fallback meaningful: wrap the component that reads the
  data, not the whole page.
- Give independent sections sibling boundaries so they stream in parallel.
- Nest boundaries for a deliberate reveal order (details first, then reviews).
- Push request data down: pass the `params`/`cookies()` promise (unawaited) to the child that needs it and await
  it inside the boundary, so the parent stays in the shell (see [async-patterns.md](async-patterns.md)).
- Use `loading.tsx` only when nothing in the page is useful without the data. Its fallback is prefetched, so
  navigation shows it immediately.
- Run `notFound()` / `forbidden()` checks before any `await` that suspends or any boundary if you need a real
  404/403 status; after streaming starts the status is fixed at 200 (a streamed 404 gets `noindex`).

**Avoid**
- Awaiting `cookies()`/`params`/data at the top of a layout; everything below becomes request-time.
- Uncached data in a `layout`: `loading.tsx` of that segment cannot cover it. Move it into the page or wrap it
  in its own `<Suspense>` inside the layout.
- Relying on one high `loading.tsx` to silence the error; the build passes but the page loses granular streaming.
- Wrapping the LCP element (hero image, main heading) in a boundary.
- Boundaries "just in case": React may show any boundary's fallback under slow network or CPU.

```tsx
// app/orders/[orderId]/page.tsx
import { Suspense } from 'react'
import { OrderHeader, OrderHeaderSkeleton } from './order-header'
import { ShippingStatus } from './shipping-status'
import { RelatedItems } from './related-items'

export default function OrderPage({ params }: PageProps<'/orders/[orderId]'>) {
  return (
    <main>
      <h1>Order details</h1> {/* static shell */}
      <Suspense fallback={<OrderHeaderSkeleton />}>
        {params.then(({ orderId }) => <OrderHeader orderId={orderId} />)}
      </Suspense>
      <div className="grid">
        <Suspense fallback={<div className="h-40" aria-busy="true" />}>
          <ShippingStatus params={params} /> {/* awaits params + uncached carrier API */}
        </Suspense>
        <Suspense fallback={<div className="h-40" aria-busy="true" />}>
          <RelatedItems params={params} />
        </Suspense>
      </div>
    </main>
  )
}
```

## Fallback design

- Match the final content's size (skeleton with the same height, or a `min-height` container) to avoid layout shift.
- Keep fallbacks deterministic: no `Math.random()` or `Date.now()` (a separate prerender error with Cache Components).
- Never render `{children}` inside a fallback; child pages can carry dynamic reads into what must be static.
- A fallback is a lightweight placeholder; if it suspends, the parent boundary takes over.
- `<html>` attributes such as `lang`, `dir`, or a theme class cannot be suspended. For theme-like values, see
  [hydration-error.md](hydration-error.md).

## Resetting a boundary on navigation

React keeps already revealed content on screen during transition updates instead of showing the fallback
again, and client-side navigations behave this way. When the content is truly different (another shelf, another
user), give the boundary a `key` tied to that value so React treats it as new and shows the fallback
(recommendation):

```tsx
// app/library/page.tsx
import { Suspense } from 'react'
import { ShelfBooks, ShelfSkeleton } from './shelf-books'

export default function LibraryPage({ searchParams }: PageProps<'/library'>) {
  return (
    <Suspense fallback={<ShelfSkeleton />}>
      {searchParams.then(({ shelf = 'all' }) => (
        <Suspense key={String(shelf)} fallback={<ShelfSkeleton />}>
          <ShelfBooks shelf={String(shelf)} />
        </Suspense>
      ))}
    </Suspense>
  )
}
```

Boundaries inside a `layout` show their fallback only on first load; a `template.tsx` remounts on every navigation
and shows it each time. Errors thrown after streaming starts are caught by the nearest `error.tsx`
(see [error-handling.md](error-handling.md)).

## Sources
Official documentation, accessed 2026-10-20 (Next.js 16.4 docs):
- https://nextjs.org/docs/app/guides/streaming
- https://nextjs.org/docs/app/api-reference/file-conventions/loading
- https://nextjs.org/docs/app/api-reference/file-conventions/template
- https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/instant
- https://nextjs.org/docs/app/getting-started/caching
- https://nextjs.org/docs/app/getting-started/fetching-data
- https://nextjs.org/docs/app/api-reference/functions/use-search-params
- https://nextjs.org/docs/messages/blocking-route
- https://nextjs.org/docs/messages/blocking-prerender-dynamic
- https://nextjs.org/docs/messages/blocking-prerender-client-hook
- https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
- https://react.dev/reference/react/Suspense
