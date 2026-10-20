# Scripts (`next/script` and third parties)

How to load third-party and inline JavaScript in a Next.js 16 App Router app without blocking rendering,
and how that interacts with Client Components and CSP nonces.

## Rules

**Do**
- Use `Script` from `next/script` instead of raw `<script>` tags. A plain synchronous `<script src>` hurts
  performance (lint rule `no-sync-scripts`); if you must use a raw tag, add `async` or `defer`.
- Place a script in the most specific layout or page that needs it. Next.js loads it once even across
  navigations within that layout. Root layout only for truly site-wide scripts.
- Give every **inline** script an `id` so Next.js can track and dedupe it.
- Put `onLoad`, `onReady` or `onError` handlers in a Client Component (`'use client'`). They do not work in
  Server Components.
- Use `onReady` (not `onLoad`) for setup that must rerun each time the component mounts, e.g. re-attaching a
  widget after navigation.

**Avoid**
- `strategy="beforeInteractive"` outside the root layout, or for anything not truly critical.
- `onLoad`/`onError` with `beforeInteractive` (unsupported; `onReady` is the documented alternative to `onLoad`).
- `strategy="worker"` in the App Router: it is experimental and currently works only in `pages/`.
- Rendering the same script from many sibling pages; hoist it to their shared layout (recommendation).

## Strategies

| Strategy | When it loads | Typical use |
| --- | --- | --- |
| `beforeInteractive` | Injected into server HTML (always in `<head>`), fetched before Next.js code; does not block hydration. Root layout only; runs once per document load, not on client navigations. | Bot detection, cookie consent |
| `afterInteractive` (default) | Injected client-side after some hydration | Analytics, tag managers |
| `lazyOnload` | Injected during browser idle time after page resources load | Chat widgets, social embeds |
| `worker` (experimental) | Web worker via Partytown, needs `experimental.nextScriptWorkers` | Pages Router only today |

```tsx
// app/layout.tsx
import Script from 'next/script'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script src="https://consent.tickets.example/cmp.js" strategy="beforeInteractive" />
        <Script id="ticket-config">{`window.ticketDesk = { locale: 'en' }`}</Script>
      </body>
    </html>
  )
}
```

```tsx
// app/support/support-chat.tsx
'use client'
import Script from 'next/script'

export function SupportChat() {
  return (
    <Script
      src="https://chat.tickets.example/widget.js"
      strategy="lazyOnload"
      // TicketChat is a global declared in a .d.ts for the vendor SDK
      onReady={() => window.TicketChat?.mount('#chat-root')}
      onError={(e) => console.error('Chat widget failed to load', e)}
    />
  )
}
```

Other attributes (`nonce`, `data-*`, etc.) are forwarded to the rendered `<script>` element.

## `@next/third-parties`

An official, still **experimental** package with pre-optimized components; import Google integrations from
`@next/third-parties/google`:

- `GoogleTagManager` (`gtmId`, or `gtmScriptUrl` for server-side tagging) plus `sendGTMEvent()`.
- `GoogleAnalytics` (`gaId`, optional `nonce`, `debugMode`) plus `sendGAEvent()`. If GTM is already present,
  configure GA through GTM instead of adding both.
- `GoogleMapsEmbed` (lazy-loaded iframe) and `YouTubeEmbed` (uses `lite-youtube-embed`).

Both GTM and GA load after hydration by default. The `send*Event` helpers are called from Client Components and
need the matching component rendered in a parent layout/page or the same file.

```tsx
// app/layout.tsx
import { GoogleAnalytics } from '@next/third-parties/google'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
      <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID!} />
    </html>
  )
}
```

Client-side navigations are reported as pageviews automatically when GA "Enhanced Measurement" history events are on.

## CSP nonces

With a nonce-based CSP (generated per request in `proxy.ts`), Next.js reads the nonce from the
`Content-Security-Policy` request header and applies it to its own framework and page scripts. Your own
`<Script>` tags need the nonce passed explicitly:

```tsx
// app/checkout/page.tsx
import { headers } from 'next/headers'
import Script from 'next/script'

export default async function CheckoutPage() {
  const nonce = (await headers()).get('x-nonce') ?? undefined
  return <Script src="https://pay.invoices.example/sdk.js" nonce={nonce} />
}
```

Nonces require dynamic rendering for every page: static generation and ISR are off, and Partial Prerendering is
incompatible because the prerendered shell cannot carry a per-request nonce. Details belong in
`engineering-paved-path:security`; rendering trade-offs are in [runtime-selection.md](runtime-selection.md).

## Sources
Official documentation, accessed 2026-10-20 (Next.js 16.4 docs):
- https://nextjs.org/docs/app/guides/scripts
- https://nextjs.org/docs/app/api-reference/components/script
- https://nextjs.org/docs/app/guides/third-party-libraries
- https://nextjs.org/docs/app/guides/content-security-policy
- https://nextjs.org/docs/messages/no-sync-scripts
- https://nextjs.org/docs/messages/inline-script-id
