# Hydration Errors

How to diagnose and fix "server-rendered HTML did not match the client" errors in the App Router.
Client Components render twice on a direct visit (on the server for HTML, then in the browser to hydrate),
and both renders must produce identical output.

## Why it matters

React treats a mismatch as a bug, not a cosmetic warning. It recovers by client-rendering from the nearest error
or Suspense boundary, which causes a visible flash, discards DOM corrections inside that boundary, and in the worst
case attaches handlers to the wrong elements. React does not promise to patch mismatched attributes.

## Common causes and fixes

| Cause | Fix |
| --- | --- |
| Invalid nesting: `<p>` in `<p>`, `<div>`/`<ul>` in `<p>`, `<a>` in `<a>`, `<button>` in `<button>` | Fix the markup to valid HTML nesting |
| `typeof window !== 'undefined'` branches in render | Render the same first pass, then switch in `useEffect` |
| `window`, `localStorage`, `matchMedia` read during render | Read in an effect, or use an inline pre-paint script (below) |
| `new Date()`, `Date.now()`, `Math.random()`, `toLocaleDateString()` in render | Compute on the server and pass as a prop, or defer to the client |
| Server locale/time zone differs from the user's | Inline script correction plus `suppressHydrationWarning` |
| Browser extensions, iOS auto-linking of phone numbers/emails | `format-detection` meta tag for iOS; extensions are outside your control |
| Misconfigured CSS-in-JS library | Follow the official CSS-in-JS guide for the App Router |
| CDN/proxy rewriting HTML (e.g. auto-minify) | Disable HTML transformation at the edge |

Tip: run the dev server with a different locale and zone from your browser, e.g. `TZ=UTC LANG=ja_JP.UTF-8 next dev`,
to surface locale mismatches locally.

## Two-pass rendering for client-only values

```tsx
// app/bookshelf/reading-streak.tsx
'use client'
import { useEffect, useState } from 'react'

export function ReadingStreak() {
  const [days, setDays] = useState<number | null>(null) // same on server and first client render
  useEffect(() => {
    setDays(Number(localStorage.getItem('streak') ?? 0))
  }, [])
  return <p>Streak: {days === null ? '...' : `${days} days`}</p>
}
```

Cost: an extra render after hydration and a visible change on slow connections. If the value must be
correct on the first paint, use an inline script instead.

For a whole widget that cannot render on the server (a map, a canvas editor), load it with
`dynamic(() => import('./map'), { ssr: false })` **from a Client Component**; `ssr: false` is rejected in Server
Components.

## Cache Components: unstable values in Client Components

With `cacheComponents: true`, calling `Date.now()`, `new Date()`, `Math.random()`, or `crypto.randomUUID()` during
render of a Client Component outside `<Suspense>` is a prerender error, because the baked HTML could not match the
browser. Fix by wrapping the component in `<Suspense>` from its Server Component parent, moving the call into
`useEffect` or an event handler, or computing the value on the server. Capture it once in a `useState` initializer
or `useRef` if it must stay stable across client re-renders.

## Correcting before paint with an inline script

When the right value is only known in the browser (theme in `localStorage`, user time zone) and a flash is
unacceptable, write a server default, then run a synchronous inline script that fixes the DOM during HTML parsing,
and mark the element with `suppressHydrationWarning` so React keeps the DOM value.

```tsx
// app/layout.tsx
const applyTheme = `(function(){try{var t=localStorage.getItem("reader-theme");if(t)document.documentElement.dataset.theme=t}catch(e){}})()`

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: applyTheme }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

- Reading a theme cookie with `cookies()` in the root layout makes every route request-time (and under Cache
  Components blocks all segments below it); read the cookie in the inline script instead.
- Inline scripts only run on full page loads. For values that must also update on `<Link>` navigations, make the
  component a Client Component so it recomputes in the browser.
- In development, Strict Mode remounts can clear attributes the script set on `<html>`; re-apply them in a
  `useLayoutEffect` in the component that owns the setting.
- A strict Content Security Policy blocks inline scripts unless you add a nonce.
- Client state that mirrors the corrected DOM should use a lazy `useState` initializer reading the same source.

## suppressHydrationWarning semantics

**Do** use it only for unavoidable differences (timestamps, script-corrected text, the `<html>` theme attribute).

**Avoid**
- Treating it as a fix: it silences the warning only; React does not patch the mismatched text.
- Expecting it to cover descendants: it works one level deep, on the element it is set on.
- Sprinkling it on wrappers to hide bugs from invalid nesting or render-time browser checks.

Related: [rsc-boundaries.md](rsc-boundaries.md) for what renders where, [suspense-boundaries.md](suspense-boundaries.md)
for boundary placement, and `engineering-paved-path:react-best-practices` for general effect usage.

## Sources
Official documentation, accessed 2026-10-20 (Next.js 16.4 docs):
- https://nextjs.org/docs/messages/react-hydration-error
- https://nextjs.org/docs/app/guides/preventing-flash-before-hydration
- https://nextjs.org/docs/app/guides/lazy-loading
- https://nextjs.org/docs/messages/blocking-prerender-current-time-client
- https://nextjs.org/docs/app/guides/server-and-client-boundary
- https://react.dev/reference/react-dom/client/hydrateRoot
