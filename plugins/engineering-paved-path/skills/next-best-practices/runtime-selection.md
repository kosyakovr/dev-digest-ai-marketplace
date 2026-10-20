# Runtime Selection (Node.js vs Edge)

Which server runtime your routes and proxy run on in Next.js 16, and why the answer is almost always
"Node.js, and do not configure anything".

## Short version

- **Node.js is the default** for pages, layouts, Route Handlers, and proxy. It has the full Node.js API surface.
- **`export const runtime = 'edge'` is deprecated** in the 16.4 docs. Next.js emits an "Edge Runtime Deprecated"
  warning; the migration is to delete the export (no replacement needed, since Node.js is the default).
- **Cache Components (`cacheComponents: true`) does not support the `runtime` segment config at all.** Remove
  every `runtime` export, including `runtime = 'nodejs'`.
- **`proxy.ts` always runs on Node.js.** Setting `runtime` in a proxy file throws an error.

## Do / Avoid

| Do | Avoid |
| --- | --- |
| Leave `runtime` unset on new pages, layouts, and Route Handlers | Adding `runtime = 'edge'` to new code |
| Remove existing `runtime = 'edge'` exports when you touch a file | Assuming `runtime = 'nodejs'` is harmless under Cache Components; it must be removed |
| Use Node.js APIs (`fs`, `crypto`, database drivers) freely in server code | Importing Node-only modules into code that still runs on Edge |
| Use `maxDuration` when a route legitimately needs a longer execution limit | Using `preferredRegion`; it is deprecated as well |
| Put edge-style request work (redirects, rewrites, header changes) in `proxy.ts` | Exporting `runtime` from `proxy.ts` |

```ts
// app/api/receipts/[id]/route.ts
// No `runtime` export: Node.js is the default and the only option under Cache Components.
import { readFile } from 'node:fs/promises'

export async function GET(_req: Request, ctx: RouteContext<'/api/receipts/[id]'>) {
  const { id } = await ctx.params
  if (!/^\d+$/.test(id)) return new Response('Not found', { status: 404 }) // never trust params
  const pdf = await readFile(`/var/receipts/${id}.pdf`)
  return new Response(pdf, { headers: { 'content-type': 'application/pdf' } })
}
```

## Migrating a legacy Edge route

```diff
// app/api/geo-hint/route.ts
- export const runtime = 'edge'
- export const preferredRegion = 'home'
  export async function GET(request: Request) { /* ... */ }
```

- The deprecation message applies to every file type that accepted the segment config (`page`, `layout`,
  `route`).
- The Cache Components migration guide says: drop the export, and use Proxy when you need edge-style behavior.
- Re-test anything that relied on Edge-only quirks (recommendation).

## Proxy and the remaining Edge use

- `proxy.ts` (the Next.js 16 name for middleware) defaults to Node.js and its runtime cannot be configured.
- The v16 upgrade guide states that Edge is **not** supported in `proxy`, and that apps wanting to keep Edge for
  this layer should keep the deprecated `middleware.ts` file. It also says further Edge instructions would come
  in a later minor release; the 16.4 docs do not add any beyond the deprecation notices above.
- Treat `middleware.ts` + Edge as a legacy path to migrate away from, not a choice for new code (recommendation).
  See [file-conventions.md](file-conventions.md) for the proxy file itself.

## If code still runs on Edge: limits to know

Applies to a remaining `runtime = 'edge'` route or an Edge `middleware.ts`.

- Only Web-standard APIs (fetch, Request/Response, Web Crypto, streams, encoding, URL, etc.) plus
  `AsyncLocalStorage`. No filesystem, no native Node.js APIs, no direct `require` (use ES modules).
  npm packages work only if they ship ES modules and avoid native Node.js APIs.
- Dynamic code evaluation is blocked: `eval()`, `new Function(...)`, `WebAssembly.compile`, and
  `WebAssembly.instantiate` with a byte buffer. Import `.wasm` files as modules instead
  (`import mod from './calc.wasm?module'`). `config.unstable_allowDynamic` (globs) only silences the build check
  for unreachable code; the call still throws if executed.
- When a Node.js module sneaks in, `next dev` reports which file imports it. Replace it (e.g. Node `crypto` ->
  Web Crypto) or stop importing it.
- No Incremental Static Regeneration, and the segment `revalidate` value is not available with Edge (previous,
  non-Cache-Components model).
- Streaming support depends on the deployment adapter for both runtimes.

```ts
// lib/sign-token.ts  -- portable across runtimes: Web Crypto, no `node:crypto`
export async function sign(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
}
```

## Runtime-aware shared code

`instrumentation.ts` runs under both runtimes. Branch on `process.env.NEXT_RUNTIME` (`'nodejs'` or `'edge'`)
and load Node-only SDKs only in the `'nodejs'` branch.

```ts
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation.node')
  }
}
```

Related: [self-hosting.md](self-hosting.md) for deployment targets, [route-handlers.md](route-handlers.md) for
segment config on handlers.

## Sources
Official documentation, accessed 2026-10-20 (Next.js 16.4 docs):
- https://nextjs.org/docs/app/api-reference/edge
- https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config
- https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime
- https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/maxDuration
- https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/preferredRegion
- https://nextjs.org/docs/app/api-reference/file-conventions/proxy
- https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
- https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents
- https://nextjs.org/docs/app/guides/migrating-to-cache-components
- https://nextjs.org/docs/app/guides/caching-without-cache-components
- https://nextjs.org/docs/app/guides/upgrading/version-16
- https://nextjs.org/docs/messages/edge-runtime-deprecated
- https://nextjs.org/docs/messages/node-module-in-edge-runtime
- https://nextjs.org/docs/messages/edge-dynamic-code-evaluation
- https://nextjs.org/docs/messages/preferred-region-deprecated
