# Parallel and Intercepting Routes

Rules for `@slot` folders, `default.tsx`, and `(.)`-style interception, including the URL-backed modal pattern.
Applies to Next.js 16 App Router.

## Slots

- A folder named `@name` defines a slot. The nearest parent `layout.tsx` receives it as a prop called `name`,
  next to `children` (which is itself an implicit slot: `app/page.tsx` behaves like `app/@children/page.tsx`).
- Slots are **not** URL segments: `app/@stats/weekly/page.tsx` serves `/weekly`.
- All slots at one segment level render together with the page, so you cannot mix a prerendered slot with a
  dynamically rendered one at the same level; if one is dynamic, they all are.
- Each slot can have its own `loading.tsx`, `error.tsx`, and even its own `layout.tsx` (e.g. tabs), so slots
  stream and fail independently (see [suspense-boundaries.md](suspense-boundaries.md), [error-handling.md](error-handling.md)).
- `LayoutProps<'/route'>` types `children` plus named slots for you.

```tsx
// app/workspace/layout.tsx
export default function WorkspaceLayout({ children, stats, inbox }: LayoutProps<'/workspace'>) {
  return (
    <div className="grid grid-cols-3">
      <main className="col-span-2">{children}</main>
      <aside>{stats}{inbox}</aside>
    </div>
  )
}
```

## `default.tsx` is required (Next.js 16)

Navigation decides what each slot shows:
- **Soft navigation** (client-side `<Link>`/router): only the slot that matches the new URL changes; other slots
  keep their last active subpage even if it does not match the URL.
- **Hard navigation** (first load, refresh): Next.js cannot recover the other slots' state, so it renders each
  unmatched slot's `default.tsx`.

In v16 every named slot needs an explicit `default.tsx`; the build fails without one. For the implicit `children`
slot, a missing `default.tsx` yields a 404 when the parent page's state cannot be recovered.

**Do**
- Return `null` from `default.tsx` for optional UI (modals, drawers), or call `notFound()` to keep the old
  "404 when unmatched" behavior.
- Add `app/<segment>/default.tsx` for `children` when a slot has subpages that `children` does not (otherwise a
  refresh on that URL 404s).
- Await `params` in `default.tsx` if you need them; it receives the dynamic params as a Promise.

**Avoid**
- Upgrading from v15 without adding `default.tsx` to each `@slot` folder.

## Conditional slots by role

```tsx
// app/workspace/layout.tsx
import { getViewer } from '@/lib/dal'

export default async function Layout({ manager, member }: LayoutProps<'/workspace'>) {
  const viewer = await getViewer()
  return viewer.role === 'manager' ? manager : member
}
```

Both `@manager` and `@member` still render on the server, and their output is part of the response; the
condition only picks what is shown. Authorize inside each slot's page or in your data access layer, never only
in the layout (see `engineering-paved-path:security`).

## Intercepting routes

Prefix a folder to render another route inside the current layout during soft navigation while the URL shows
the target route. On refresh or direct visit, the real route renders instead.

| Prefix | Intercepts a segment |
| --- | --- |
| `(.)` | on the same level |
| `(..)` | one level up |
| `(..)(..)` | two levels up |
| `(...)` | from the `app` root |

Levels count **route segments**, not file-system folders: `@slot` folders do not count.
A file at `app/tickets/@preview/(.)[id]/page.tsx` intercepts `/tickets/[id]` because `@preview`
adds no level.

## Modal pattern (parallel + intercepting)

```
app/tickets/
  layout.tsx            -> renders {children} and {preview}
  page.tsx              -> ticket list
  [id]/page.tsx         -> full ticket page (direct visits, refresh)
  @preview/default.tsx  -> return null (modal closed)
  @preview/(.)[id]/page.tsx -> <Modal><TicketDetails id=... /></Modal>
```

```tsx
// app/tickets/@preview/(.)[id]/page.tsx
import { Modal } from '@/components/modal'
import { TicketDetails } from '@/components/ticket-details'

export default async function TicketPreview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <Modal><TicketDetails id={id} /></Modal>
}
```

```tsx
// components/modal.tsx
'use client'
import { useRouter } from 'next/navigation'

export function Modal({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  return (
    <div role="dialog" aria-modal="true">
      <button onClick={() => router.back()}>Close</button>
      {children}
    </div>
  )
}
```

**Do**
- Keep `Modal` as the only Client Component and pass server-rendered content as `children`, so the details stay
  Server Components ([rsc-boundaries.md](rsc-boundaries.md)).
- Close with `router.back()`; the URL, back, and forward buttons then behave as users expect.
- If you close by linking elsewhere, make the slot match something that returns `null`: an
  `@preview/page.tsx` for the slot's own index, plus an `@preview/[...rest]/page.tsx` catch-all for other URLs.
  A slot that no longer matches stays visible after soft navigation.

**Avoid**
- Counting `@preview` as a level and writing `(..)[id]` here; that would target a segment above `tickets`.

## Reading the active segment of a slot

`useSelectedLayoutSegment('stats')` and `useSelectedLayoutSegments('stats')` (Client Component hooks from
`next/navigation`) accept the slot name as `parallelRouteKey` and return that slot's active segment(s) (or
`null` / an empty list). Use them for active-tab styling in a slot-level nav.

## Sources
Official documentation, accessed 2026-10-20 (Next.js 16.4 docs):
- https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes
- https://nextjs.org/docs/app/api-reference/file-conventions/intercepting-routes
- https://nextjs.org/docs/app/api-reference/file-conventions/default
- https://nextjs.org/docs/app/api-reference/functions/use-selected-layout-segment
- https://nextjs.org/docs/app/api-reference/functions/use-selected-layout-segments
- https://nextjs.org/docs/app/getting-started/project-structure
- https://nextjs.org/docs/app/guides/upgrading/version-16
