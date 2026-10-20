# Error Handling

How to separate expected failures from real bugs in the App Router, and which Next.js boundary or
control-flow function handles each case in Next.js 16.

## Two kinds of errors

| Kind | Examples | Handle with |
| --- | --- | --- |
| Expected | validation failure, upstream 4xx/5xx, missing record | return values, `notFound()`, `forbidden()`, `unauthorized()`, `redirect()` |
| Uncaught exception | bug, broken invariant, unreachable dependency | `throw`; caught by `error.tsx`, `catchError`, `global-error.tsx` |

**Do**
- Model expected failures in Server Functions as *return values* and render them with `useActionState`.
- In Server Components, branch on the response (`if (!res.ok)`) and render a message, `notFound()` or `redirect()`.
- Let truly unexpected errors throw so the nearest error boundary catches them.

**Avoid** throwing for validation errors from a Server Action (validate with `engineering-paved-path:zod`).

```ts
// app/tickets/actions.ts
'use server'
export type TicketState = { error?: string }
export async function openTicket(_prev: TicketState, form: FormData): Promise<TicketState> {
  const subject = String(form.get('subject') ?? '').trim()
  if (subject.length < 5) return { error: 'Subject must be at least 5 characters.' }
  const res = await fetch('https://helpdesk.example.com/tickets', { method: 'POST', body: subject })
  if (!res.ok) return { error: 'Helpdesk is unavailable, try again later.' }
  return {}
}
```

```tsx
// app/tickets/new-ticket-form.tsx
'use client'
import { useActionState } from 'react'
import { openTicket } from './actions'
export function NewTicketForm() {
  const [state, action, pending] = useActionState(openTicket, {})
  return (
    <form action={action}>
      <input name="subject" />
      {state.error && <p aria-live="polite">{state.error}</p>}
      <button disabled={pending}>Open ticket</button>
    </form>
  )
}
```

## error.tsx (segment error boundary)

- Must be a Client Component (`'use client'`). In its segment it wraps `loading`, `not-found`, `page`
  and nested layouts, but **not** the `layout.tsx`/`template.tsx` of the same segment.
  Put the boundary one level up to cover that layout.
- Props in v16: `error` (typed `unknown`; narrow with `instanceof Error`) and `retry()`. `retry` became
  stable in 16.3 (it was `unstable_retry` in 16.2). `retry()` re-fetches and re-renders the segment;
  `reset()` still exists but only clears the error state without re-fetching, so prefer `retry()`.
- In production, errors from Server Components reach the client with a generic message plus
  `error.digest`; log the digest and match it against server logs. Never rely on `error.message` for UI copy.
- Re-`throw` inside the error component to bubble up to the parent boundary.

```tsx
// app/invoices/error.tsx
'use client'
import { useEffect } from 'react'
export default function InvoicesError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined
    reportToMonitoring({ digest }) // your logger (recommendation)
  }, [error])
  return <button onClick={() => retry()}>Invoices failed to load. Try again</button>
}
```

**global-error.tsx** lives in `app/`, replaces the root layout when active, and therefore must render its
own `<html>` and `<body>` and import any styles/fonts it needs. It cannot export `metadata`; use React's
`<title>` instead. It does not see your app theme class.

## catchError (component-level boundary)

`catchError` from `next/error` (stable since 16.3) turns a fallback `(props, { error, retry, reset })`
into a wrapper component usable anywhere in the tree. Prefer it over a hand-written React error boundary:
it lets `redirect()`/`notFound()` pass through, offers `retry()`, and clears on client navigation.
The fallback module must be `'use client'`. Do not wrap `error.tsx` exports with it.

Error boundaries do not catch errors in event handlers or other async code after render; keep those in
`useState`. An error thrown inside `startTransition` does bubble to the nearest boundary.

## Not found, forbidden, unauthorized

- `notFound()` (from `next/navigation`) renders the nearest `not-found.tsx`; root `app/not-found.tsx` also
  serves unmatched URLs. Works in Server Components, Server Functions and Route Handlers.
- `forbidden()` (403) and `unauthorized()` (401) render `forbidden.tsx` / `unauthorized.tsx`. Both are
  experimental and require `experimental.authInterrupts: true` in `next.config.ts`; neither can be called
  in the root layout.
- All of these throw (`never` return type): no `return` needed, and TypeScript narrows afterward.
- Call them on the render path (a component or a function it `await`s). In an un-awaited promise they
  throw into nothing and no fallback UI renders.
- Status codes: before streaming starts you get 404/403/401; once a `<Suspense>` boundary has started
  streaming, the status stays `200` and the fallback UI renders in place (with a `noindex` meta tag).
  Do the check early, or in Proxy, if the status code matters.

## redirect() and try/catch

`redirect()` (307, or 303 for no-JS Server Action form posts) and `permanentRedirect()` (308) throw
`NEXT_REDIRECT`. Default history mode is `push` in Server Actions, `replace` elsewhere.

**Do** call `redirect`/`notFound` after the `try/catch`, or call `unstable_rethrow(err)` first in the
`catch` when the block may see both app errors and framework interrupts.
**Avoid** `redirect()` in client event handlers (use `useRouter().push`) and catching interrupts by accident.

```ts
// app/bookshelf/actions.ts
'use server'
import { redirect, unstable_rethrow } from 'next/navigation'
import { revalidatePath } from 'next/cache'
export async function addBook(form: FormData) {
  let id: string
  try {
    id = await db.books.insert({ title: String(form.get('title')) })
  } catch (err) {
    unstable_rethrow(err) // lets framework interrupts through
    return { error: 'Could not save the book.' }
  }
  revalidatePath('/bookshelf')
  redirect(`/bookshelf/${id}`) // outside the try block
}
```

`unstable_rethrow` also re-throws request-time bailout errors (e.g. from `cookies()`/`headers()`), so call
it at the very top of the `catch`.

See also: [route-handlers.md](route-handlers.md), [functions.md](functions.md), [file-conventions.md](file-conventions.md).

## Sources
Official documentation, accessed 2026-10-20 (Next.js 16.4 docs):
- https://nextjs.org/docs/app/getting-started/error-handling
- https://nextjs.org/docs/app/api-reference/file-conventions/error
- https://nextjs.org/docs/app/api-reference/functions/catchError
- https://nextjs.org/docs/app/api-reference/file-conventions/not-found
- https://nextjs.org/docs/app/api-reference/functions/not-found
- https://nextjs.org/docs/app/api-reference/file-conventions/forbidden
- https://nextjs.org/docs/app/api-reference/file-conventions/unauthorized
- https://nextjs.org/docs/app/api-reference/functions/forbidden
- https://nextjs.org/docs/app/api-reference/functions/unauthorized
- https://nextjs.org/docs/app/api-reference/functions/redirect
- https://nextjs.org/docs/app/api-reference/functions/permanentRedirect
- https://nextjs.org/docs/app/api-reference/functions/unstable_rethrow
- https://nextjs.org/docs/app/guides/redirecting
