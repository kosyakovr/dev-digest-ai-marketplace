# Bundling (Turbopack, packages, lazy loading)

How Next.js 16 bundles your app, how to configure Turbopack, keep server and client bundles small,
and diagnose what ended up where.

## Turbopack is the default in v16

- `next dev` and `next build` both use Turbopack; the `--turbopack`/`--turbo` flags are no longer needed.
- Opt out per command with `--webpack` (e.g. `"build": "next build --webpack"`).
- If `next.config` contains a `webpack` function (possibly added by a plugin) and you run `next build`, the
  build **fails** on purpose. Choose: migrate to `turbopack` options, run `next build --turbopack` to ignore
  the webpack config, or keep webpack with `--webpack`.
- Turbopack does not type-check (run `tsc` separately) and does not run webpack **plugins**. Many webpack
  **loaders** that return JavaScript do work via `turbopack.rules`.
- If a Babel config file exists, Turbopack applies Babel automatically (SWC still handles Next.js transforms).

## Configure Turbopack at the top level

`experimental.turbopack` became a top-level `turbopack` key (`experimental.turbo` remains only as an alias).

```ts
// next.config.ts
import type { NextConfig } from 'next'

const config: NextConfig = {
  turbopack: {
    rules: {
      '*.svg': { loaders: ['@svgr/webpack'], as: '*.js' }, // SVGs as React components
    },
    resolveAlias: {
      '~*': '*', // only if you cannot drop legacy Sass `~` imports
      fs: { browser: './lib/empty-module.ts' }, // last resort; fix the import instead
    },
  },
  serverExternalPackages: ['@invoices/pdf-native'],
  transpilePackages: ['@bookshelf/ui-src'],
  experimental: { optimizePackageImports: ['@recipes/icons'] },
}
export default config
```

- `rules` globs match file names; a glob containing `/` matches the project-relative path. Loader options must
  be plain serializable values.
- `resolveAlias` supports only the `browser` condition. `resolveExtensions` **replaces** the default list.
- Turbopack does not support the Sass `~node_modules` prefix: write `@import 'bootstrap/...'`.
- Files outside the project root are not resolved. Use `turbopack.root` (or the experimental
  `turbopackAdditionalRoots` for linked packages) in monorepos.
- Not supported: `sassOptions.functions`, Yarn PnP, `experimental.urlImports`, `esmExternals`, and some
  experimental flags such as `nextScriptWorkers`.

## Packages: which option does what

| Option | Use it when |
| --- | --- |
| `serverExternalPackages` | A server dependency uses Node-specific features/native addons and should be `require`d at runtime instead of bundled into Server Components / Route Handlers. Many (e.g. `sharp`, `@prisma/client`, `pg`) are already external by default. |
| `transpilePackages` | A `node_modules` package ships raw TS/JSX or untranspiled syntax. Workspace packages are transpiled automatically by Turbopack. Package names only, no globs. Never list a package here and in `serverExternalPackages` (build error). |
| `experimental.optimizePackageImports` | A package with hundreds of re-exports (icons, utilities). Common ones such as `lucide-react`, `date-fns`, `lodash-es` and `@mui/material` are already handled. |

## Keep code on the right side

**Do**
- Do heavy, non-interactive work (markdown, syntax highlighting, charts rendered to static output) in Server
  Components so the library never ships to the browser.
- Add `import 'server-only'` to modules with secrets or server-only APIs, and `import 'client-only'` to code
  touching `window`. Installing the packages is optional; Next.js handles them internally. See
  [rsc-boundaries.md](rsc-boundaries.md) and [directives.md](directives.md).
- Lazy-load heavy Client Components with `next/dynamic` or `React.lazy` + `Suspense`, and libraries with `import()`.

**Avoid**
- `ssr: false` in a Server Component: it errors. Use it only inside a Client Component.
- Expecting `next/dynamic` in a Server Component to code-split the imported Client Component; automatic
  splitting there is not supported. Lazy loading targets Client Components (Server Components are split already).

```tsx
// app/tickets/ticket-board.tsx
'use client'
import dynamic from 'next/dynamic'
import { useState } from 'react'

const Gantt = dynamic(() => import('./gantt-chart').then((m) => m.GanttChart), {
  ssr: false,
  loading: () => <p>Loading timeline...</p>,
})

export function TicketBoard() {
  const [showTimeline, setShowTimeline] = useState(false)
  async function exportCsv() {
    const { unparse } = await import('papaparse') // fetched only on click
    console.log(unparse([{ id: 1, status: 'open' }]))
  }
  return (
    <>
      <button onClick={() => setShowTimeline(true)}>Timeline</button>
      <button onClick={exportCsv}>Export</button>
      {showTimeline && <Gantt />}
    </>
  )
}
```

Magic comments work on dynamic `import()`/`require()` only: `webpackIgnore`/`turbopackIgnore` leave the import
unbundled; `turbopackOptional` suppresses build errors for a possibly-missing module.

## CSS imports

- CSS order follows JS import order. Import global CSS and Tailwind once in the root layout; use CSS Modules
  or Tailwind for component styles. Global stylesheets are not removed on navigation, so keep them truly global.
- Turbopack orders CSS Modules strictly by import order; webpack sometimes did not. Verify order with
  `next build`, since dev can differ.
- In CSS Modules, `composes` from or `@import` of a plain `.css` file treats it as global; rename to `.module.css`.

## Analyze bundles

- `next analyze` (v16.1+) opens a Turbopack-native analyzer: filter by route, client/server, file type; click a
  module to see its import chain. `next analyze --output` writes to `.next/diagnostics/analyze`.
- v16.4+: `next analyze --output --snapshot before` then `next analyze export --snapshot before > graph.jsonl`
  gives JSON Lines for scripts or agents.
- With `--webpack` builds, use the `@next/bundle-analyzer` plugin instead.

## Build caching

Turbopack's filesystem cache is on by default for dev (`.next/dev/cache/turbopack`, since 16.1) and build
(`.next/cache/turbopack`, since 16.3). Persist `.next/cache` in CI/Docker builds, or set
`experimental.turbopackFileSystemCacheForBuild: false` if it is never restored.

## Sources
Official documentation, accessed 2026-10-20 (Next.js 16.4 docs):
- https://nextjs.org/docs/app/guides/package-bundling
- https://nextjs.org/docs/app/guides/lazy-loading
- https://nextjs.org/docs/app/api-reference/turbopack
- https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack
- https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages
- https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages
- https://nextjs.org/docs/app/api-reference/config/next-config-js/optimizePackageImports
- https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopackFileSystemCache
- https://nextjs.org/docs/app/api-reference/config/next-config-js/webpack
- https://nextjs.org/docs/app/getting-started/css
- https://nextjs.org/docs/app/getting-started/server-and-client-components
- https://nextjs.org/docs/app/guides/upgrading/version-16
