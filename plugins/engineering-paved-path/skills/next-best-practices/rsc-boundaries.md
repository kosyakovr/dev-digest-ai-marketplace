# Server and Client Component Boundaries

How to decide what runs where in the App Router, and what is allowed to cross from the server module graph
into the client module graph. Directive syntax details live in [directives.md](directives.md).

## Mental model

- Pages and layouts are Server Components by default. There is no "server" directive for components;
  `'use server'` marks Server Functions, not components.
- `'use client'` marks a module as a client entry point. That module and everything it imports join the
  client bundle. Server Components passed in as `children` or other props do not.
- Client Components render on the server for the first HTML, then hydrate; Server Component code never ships.
- Two things cross the boundary: **code** (through imports) and **data** (through props, which must be serializable).

## Choosing the environment

| Need | Use |
| --- | --- |
| State, effects, event handlers, custom hooks, `window`/`localStorage` | Client Component |
| Database, filesystem, secrets, API keys | Server Component |
| Less JavaScript in the browser, streaming output | Server Component |
| A `<form>` that posts, a `<details>` toggle | Often neither needs a Client Component |

**Do**
- Push `'use client'` down to the smallest interactive leaf (a search box, a like button), not the whole layout.
- Add `'use client'` only at the entry file of a client subtree; files it imports are already client code.
- Fetch data in Server Components and pass plain values down as props.

**Avoid**
- Marking a page or layout `'use client'` just to use one hook; extract the interactive part instead.
- `async` Client Components. They are not supported and raise "Client components cannot be async functions".
  Fetch in a Server Component, or pass a promise and unwrap it with `use()` (see [async-patterns.md](async-patterns.md)).

## What can cross as props

Allowed (React serialization): primitives, plain objects, arrays, `Map`, `Set`, `Date`, typed arrays,
`Promise`s, JSX elements, and Server Functions (sent as references).
Rejected: ordinary functions (event handlers, callbacks), class instances, null-prototype objects, non-global symbols.

```tsx
// app/tickets/[id]/page.tsx
import { TicketActions } from './ticket-actions'
import { getTicket, closeTicket } from '@/lib/tickets'

export default async function TicketPage({ params }: PageProps<'/tickets/[id]'>) {
  const { id } = await params
  const ticket = await getTicket(id)

  async function closeAction() {
    'use server'
    await closeTicket(id) // re-check auth inside closeTicket
  }

  // OK: strings, numbers, and a Server Function reference
  return <TicketActions title={ticket.title} priority={ticket.priority} closeAction={closeAction} />
  // NOT OK: onClose={() => console.log('closed')} -- plain functions cannot cross
}
```

Name function props `action` or `...Action`; the Next.js TypeScript plugin accepts those as Server Function
props and flags other function-typed props on Client Components.

## Composing: Server Components inside Client Components

A Client Component cannot import a Server Component, but it can render one it receives as a prop.
The owner (the Server Component that wrote the JSX) decides where it runs.

```tsx
// app/ui/collapsible.tsx
'use client'
import { useState, type ReactNode } from 'react'

export function Collapsible({ heading, children }: { heading: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <section>
      <button onClick={() => setOpen(!open)}>{heading}</button>
      {open && children}
    </section>
  )
}
```

```tsx
// app/shelf/page.tsx
import { Collapsible } from '@/app/ui/collapsible'
import { BookList } from './book-list' // async Server Component, queries the DB

export default function ShelfPage() {
  return (
    <Collapsible heading={<span>My books</span>}>
      <BookList />
    </Collapsible>
  )
}
```

**Avoid** compound components with static members (`Tabs.Panel`) across the boundary: a Server Component
receives a client reference, so `Tabs.Panel` is `undefined`. Export the pieces as named exports instead.

## Context providers

Server Components cannot create or read React context. Put the provider in a `'use client'` file that
takes `children`, render it from a layout, and wrap only `{children}` rather than `<html>` so static parts
stay optimizable.

```tsx
// app/layout.tsx
import { CurrencyProvider } from './currency-provider' // 'use client' module

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <body><CurrencyProvider initial="EUR">{children}</CurrencyProvider></body>
    </html>
  )
}
```

## Third-party components without 'use client'

A package component that uses hooks but lacks the directive errors in a Server Component. Re-export it
(library authors: ship `'use client'` on client-only entry points instead):

```tsx
// app/ui/date-picker.tsx
'use client'
export { DatePicker } from 'some-datepicker-lib'
```

## Keeping server code and secrets on the server

- Add `import 'server-only'` to modules holding secrets or data access; importing them from client code is a
  build error. `import 'client-only'` marks `window`-dependent modules. Installing either package is optional.
- Only `NEXT_PUBLIC_*` variables reach the browser, and they are inlined at `next build`, so changing them later
  has no effect on the client bundle. Unprefixed variables become empty strings in client code.
- Props are serialized into the page payload. Pass only the fields the UI needs, never whole DB rows
  (see `engineering-paved-path:security`). React taint APIs (`experimental.taint`) are an extra safety net, not a filter.
  Treat Client Components as browser code even though they also render on the server.

## Sources
Official documentation, accessed 2026-10-20 (Next.js 16.4 docs):
- https://nextjs.org/docs/app/getting-started/server-and-client-components
- https://nextjs.org/docs/app/guides/server-and-client-boundary
- https://nextjs.org/docs/app/guides/data-security
- https://nextjs.org/docs/app/guides/environment-variables
- https://nextjs.org/docs/app/api-reference/directives/use-client
- https://nextjs.org/docs/messages/no-async-client-component
- https://react.dev/reference/rsc/server-components
- https://react.dev/reference/rsc/use-client
