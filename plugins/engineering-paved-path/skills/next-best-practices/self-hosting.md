# Self-Hosting Next.js 16

How to run a Next.js 16 App Router app yourself (Node.js server, Docker, multiple instances, static export)
and which settings must be consistent across instances and deployments.

## Pick a deployment mode

| Mode | Features | Notes |
| --- | --- | --- |
| `next build` + `next start` | All | Simplest; supports image optimization, Proxy, ISR, `after()`, Cache Components. |
| Docker (often `output: 'standalone'`) | All | Same server, minimal image. |
| `output: 'export'` | Limited | Static files in `out/`; no server features (see below). |
| Adapter (`adapterPath`) | Varies | Platform integration API, top-level option since v16.2 (was `experimental.adapterPath`). |

**Do**
- Put a reverse proxy (e.g. nginx) in front of `next start` to handle malformed requests, slow clients,
  body limits and rate limiting.
- Build once, promote the same artifact through environments (recommendation; see env vars below).
- On shutdown, send `SIGTERM`/`SIGINT` and allow a drain period (docs suggest 10-30 s) so in-flight requests
  and pending `after()` callbacks finish.

## `output: 'standalone'`

`next build` traces each route's dependencies and writes `.next/standalone` with a minimal `server.js` and
only the needed `node_modules`. It does **not** copy `public/` or `.next/static/` (expected to be on a CDN).
Copy them yourself if the Node server should serve them:

```bash
# after next build
cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/
PORT=3000 HOSTNAME=0.0.0.0 node .next/standalone/server.js
```

- Monorepo: set `outputFileTracingRoot` to the repo root so files outside the app folder are traced.
- Missing or extra files: use `outputFileTracingIncludes` / `outputFileTracingExcludes` (keys are route globs,
  values are globs from the project root), e.g. native binaries `'/*': ['node_modules/sharp/**/*']`.

```dockerfile
# Dockerfile (outline, recommendation; see the official with-docker example for a full version)
FROM node:22-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci && npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
CMD ["node", "server.js"]
```

Docker for local development on Mac/Windows is slower; the docs recommend plain `next dev` there.

## Environment variables

- `NEXT_PUBLIC_*` values are **inlined at `next build`**; changing them at runtime has no effect. Only literal
  `process.env.NEXT_PUBLIC_X` is inlined, not `process.env[name]`.
- Server-only variables can be read at runtime. With one image across environments, read them during dynamic
  rendering, after `await connection()` (or another Request-time API), so the value is not frozen at build.

```tsx
// app/status/page.tsx
import { connection } from 'next/server'

export default async function StatusPage() {
  await connection() // render per request, read env at runtime
  return <p>Region: {process.env.INVOICE_REGION}</p>
}
```

## Running multiple instances

| Concern | What to configure |
| --- | --- |
| Server Function encryption | Same `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (base64 AES key, 16/24/32 bytes) at build for all instances, or "Failed to find Server Action" errors. |
| Version skew | `deploymentId` (or `NEXT_DEPLOYMENT_ID`). Adds `?dpl=` to assets and an `x-deployment-id` header; a mismatch triggers a hard reload. Next.js does not route on `?dpl=`; your proxy/CDN must route by deployment. |
| Build ID | Use one build for all containers; if you rebuild per stage, set `generateBuildId`. With `deploymentId` set, the build ID is constant unless you override it. |
| ISR / route cache (`cacheHandler`, singular) | Default is per-instance memory (50 MB) + local disk. Point `cacheHandler` at a shared store (Redis, S3) and set `cacheMaxMemorySize: 0`. Implement `get`, `set`, `revalidateTag`, `resetRequestCache`; serialize `Buffer`/`Map` values; index by tag. |
| `'use cache'` (`cacheHandlers`, plural) | With `cacheComponents`, the default is an in-memory LRU per process. Configure `cacheHandlers.default` / `.remote` (top-level since v16.0) and use `'use cache: remote'` for shared data. Implement `updateTags` + `refreshTags` so `revalidateTag()` on one instance reaches the others. |

```ts
// next.config.ts
import type { NextConfig } from 'next'

const config: NextConfig = {
  output: 'standalone',
  deploymentId: process.env.GIT_SHA,
  cacheHandler: require.resolve('./cache/isr-handler.js'),
  cacheMaxMemorySize: 0,
  cacheHandlers: { remote: require.resolve('./cache/remote-handler.js') },
}
export default config
```

## Images, streaming, CDNs

- `next/image` optimization works with `next start` out of the box. On glibc Linux, `sharp` may need a memory
  allocator tweak. Tune `images.maximumDiskCacheSize`; set `images.customCacheHandler: true` (v16.2+) to store
  optimized images in your `cacheHandler`. Forward the `Accept` header through proxies. See [image.md](image.md).
- Streaming (Suspense, `loading.tsx`, PPR) requires every hop to pass chunked responses unbuffered. For nginx,
  send `X-Accel-Buffering: no` (e.g. via `headers()` in `next.config`); check load balancers too.
- Hashed static assets get `public, max-age=31536000, immutable`; dynamic pages get `private, no-cache, no-store`.
  Use `assetPrefix` to serve assets from a CDN domain.

## Static export (`output: 'export'`)

Builds HTML/CSS/JS into `out/`. Not supported: dynamic routes without `generateStaticParams` or with
`dynamicParams: true`, request-dependent Route Handlers (only `GET` with `dynamic = 'force-static'`), cookies,
rewrites/redirects/headers, Proxy, ISR, default-loader image optimization (use a custom `loaderFile`), Draft
Mode, Server Actions, intercepting routes. Using them errors in `next dev`.

Related: caching modes in [data-patterns.md](data-patterns.md); runtime choice in [runtime-selection.md](runtime-selection.md).

## Sources
Official documentation, accessed 2026-10-20 (Next.js 16.4 docs):
- https://nextjs.org/docs/app/guides/self-hosting
- https://nextjs.org/docs/app/getting-started/deploying
- https://nextjs.org/docs/app/api-reference/config/next-config-js/output
- https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers
- https://nextjs.org/docs/app/api-reference/config/next-config-js/incrementalCacheHandlerPath
- https://nextjs.org/docs/app/api-reference/config/next-config-js/deploymentId
- https://nextjs.org/docs/app/api-reference/config/next-config-js/adapterPath
- https://nextjs.org/docs/app/guides/environment-variables
- https://nextjs.org/docs/app/guides/static-exports
- https://nextjs.org/docs/app/guides/production-checklist
