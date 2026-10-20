---
name: next-best-practices
description: "Next.js App Router, RSC, server components, client components, route handlers, Server Actions, metadata, next/image, next/font, next/script, caching (use cache), proxy, streaming, hydration errors, self-hosting. Use when writing, reviewing, debugging, or upgrading Next.js 16 App Router code: file conventions, async params/cookies/headers, data fetching and revalidation, error boundaries, parallel/intercepting routes, bundling with Turbopack, or deployment."
user-invocable: false
---

# Next.js Best Practices

Written for Next.js 16.x, App Router (verified against the 16.4 documentation, October 2026).

Use this skill as an index: read the rules below, then open the topic file that matches the
task. Each topic file lists the official documentation pages it was written from. Where a topic
file gives advice the docs do not state, it is labelled as a recommendation.

## Highest-impact rules

1. **Await every request-time API.** `params`, `searchParams`, `cookies()`, `headers()` and
   `draftMode()` are Promises. Next.js 16 removed the temporary synchronous access that 15 still
   allowed. In Client Components, unwrap a passed Promise with React `use()`.
   See [async-patterns.md](async-patterns.md).
2. **Server Components by default.** Add `'use client'` only at the interactive leaves of the
   tree. Everything a Client Component receives from the server must be serializable; pass Server
   Components through `children` or other slot props instead of importing them.
   See [rsc-boundaries.md](rsc-boundaries.md) and [directives.md](directives.md).
3. **Read in Server Components, write with Server Functions.** Fetch data where it is rendered,
   start independent requests in parallel, and treat every `'use server'` function as a public
   endpoint: validate input and check authorization inside it.
   See [data-patterns.md](data-patterns.md).
4. **Know which caching model the app uses.** With `cacheComponents: true` (on by default in new
   `create-next-app` projects and recommended for all apps as of 16.4), data is dynamic by
   default and you opt in with `'use cache'`, `cacheLife` and `cacheTag`; runtime data must sit
   inside `<Suspense>`. Without it, the previous model (fetch options, segment config) applies.
   In 16, `revalidateTag` takes a cache-life profile as its second argument, and `updateTag`
   gives read-your-writes from Server Actions. See [data-patterns.md](data-patterns.md).
5. **Stream deliberately.** Put `<Suspense>` boundaries (or `loading.tsx`) around slow or
   request-dependent parts so the rest of the page can be prerendered and shown immediately.
   See [suspense-boundaries.md](suspense-boundaries.md).
6. **Use `proxy.ts`, not `middleware.ts`.** The middleware file and export names are deprecated
   in 16; `proxy` runs on the Node.js runtime only. The `edge` runtime segment config is
   deprecated. See [file-conventions.md](file-conventions.md) and
   [runtime-selection.md](runtime-selection.md).
7. **Give every parallel route slot a `default.tsx`.** Builds fail in 16 when a slot lacks one.
   See [parallel-routes.md](parallel-routes.md).
8. **Let control-flow functions throw.** `redirect()`, `notFound()`, `forbidden()` and
   `unauthorized()` work by throwing; do not swallow them in `try/catch`. Error boundaries
   (`error.tsx`) must be Client Components. See [error-handling.md](error-handling.md).
9. **Use the built-in primitives.** `next/image` (16 changed several defaults, such as
   `qualities` and `minimumCacheTTL`), `next/font`, `next/script`, and the `metadata` /
   `generateMetadata` exports instead of raw tags in `<head>`. See [image.md](image.md),
   [font.md](font.md), [scripts.md](scripts.md), [metadata.md](metadata.md).
10. **Turbopack is the default bundler** for `next dev` and `next build`. A custom `webpack`
    config makes `next build` fail unless you choose a bundler explicitly (`--webpack` to opt
    out). See [bundling.md](bundling.md).
11. **Make hydration deterministic.** Never render values that differ between server and
    browser (time, random IDs, `window` checks) during the first render.
    See [hydration-error.md](hydration-error.md).

## Topic to file

| Topic | File |
| --- | --- |
| Project layout, special files, dynamic segments, route groups, `proxy.ts` | [file-conventions.md](file-conventions.md) |
| Server vs Client Components, serializable props, `server-only` | [rsc-boundaries.md](rsc-boundaries.md) |
| `'use client'`, `'use server'`, `'use cache'` and its variants | [directives.md](directives.md) |
| Async `params`, `searchParams`, `cookies()`, `headers()`, `draftMode()` | [async-patterns.md](async-patterns.md) |
| Fetching, mutations, caching, revalidation, request dedup | [data-patterns.md](data-patterns.md) |
| Streaming, `loading.tsx`, `<Suspense>` placement | [suspense-boundaries.md](suspense-boundaries.md) |
| `error.tsx`, `global-error.tsx`, `not-found.tsx`, redirects, auth interrupts | [error-handling.md](error-handling.md) |
| Hooks and server functions: navigation, `after`, `connection`, generate functions | [functions.md](functions.md) |
| `route.ts` handlers, `NextRequest` / `NextResponse`, handlers vs Server Actions | [route-handlers.md](route-handlers.md) |
| `@slot` parallel routes, intercepting routes, modals, `default.tsx` | [parallel-routes.md](parallel-routes.md) |
| Node.js vs Edge runtime, `runtime` segment config | [runtime-selection.md](runtime-selection.md) |
| `metadata`, `generateMetadata`, viewport, OG images, sitemap, robots | [metadata.md](metadata.md) |
| `next/image`, remote patterns, sizes, image config defaults | [image.md](image.md) |
| `next/font` (Google and local), CSS variables, Tailwind | [font.md](font.md) |
| `next/script` strategies, third-party scripts, CSP | [scripts.md](scripts.md) |
| Turbopack, server externals, transpiling packages, lazy loading | [bundling.md](bundling.md) |
| Hydration mismatch causes and fixes | [hydration-error.md](hydration-error.md) |
| `next start`, standalone output, Docker, multi-instance caching | [self-hosting.md](self-hosting.md) |
| Dev-server MCP, debugger, CLI debug flags, logging | [debug-tricks.md](debug-tricks.md) |

## Working method

- Before changing version-sensitive code, check `package.json` for the installed `next` major.
  This skill describes 16.x; for older majors, verify each rule against that version's docs.
- Check `next.config.*` for `cacheComponents` before giving caching advice; the two caching
  models use different APIs.
- Prefer the official codemods (`npx @next/codemod`) for mechanical upgrades, then review the
  result by hand.
- When a request is about plain React (hooks, state, component design), use
  `engineering-paved-path:react-best-practices`. For input validation in Server Functions and
  Route Handlers, see `engineering-paved-path:zod`; for auth and secret handling, see
  `engineering-paved-path:security`.

## Sources

Official documentation, accessed 2026-10-20 (Next.js 16.4 docs):

- https://nextjs.org/docs/app/guides/upgrading/version-16
- https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents
- https://nextjs.org/docs/app/getting-started/caching
- https://nextjs.org/docs/messages/edge-runtime-deprecated
- https://nextjs.org/blog/next-16-4
