# Debug Tricks

A practical toolkit for diagnosing Next.js 16 problems: the dev server's MCP endpoint for agents, CLI flags
for build and prerender failures, logging, debuggers, and dev-performance tracing.

## 1. Ask the running dev server (MCP)

Since v16, `next dev` exposes an MCP endpoint at `/_next/mcp` (on by default; `experimental.mcpServer: false`
disables it). Coding agents connect via the `next-devtools-mcp` package, e.g. in `.mcp.json`:

```json
{ "mcpServers": { "next-devtools": { "command": "npx", "args": ["-y", "next-devtools-mcp@latest"] } } }
```

`nextjs_index` discovers running dev servers; `nextjs_call` invokes their runtime tools:

| Runtime tool | Use it to |
| --- | --- |
| `get_errors` | Read current config, build and browser runtime errors with source-mapped stacks (browser errors come from open browser sessions) |
| `get_logs` | Get the dev log file path (server output + browser console) |
| `get_routes` | List every App/Pages Router entry point |
| `get_page_metadata` | See what contributes to the current page render |
| `get_compilation_issues` / `compile_route` | Check compilation without `next build` or an HTTP request (Turbopack only) |
| `get_server_action_by_id` | Map a Server Action ID to its file and export |
| `get_request_insights` | Request timelines, server fetches, cache behavior (needs `experimental.requestInsights`) |

**Do** prefer `compile_route` / `get_compilation_issues` over repeated full builds while editing. The
version-matched docs ship inside `node_modules/next/dist/docs/`; read those rather than guessing APIs.

## 2. Build and prerender failures

| Command | What it gives you |
| --- | --- |
| `next build --debug-prerender` | Unminified server code, server source maps, and the build continues past the first prerender error. Never deploy its output. |
| `next build --debug-build-paths="app/invoices/[id]/page.tsx"` | Builds only matching routes (comma-separated, globs, `!` to exclude); `/_not-found` is added for App Router. |
| `next build --debug` (`-d`) | Verbose output, including rewrites, redirects and headers. |
| `next build --profile` | React production profiling. |
| `next build --no-mangling` | Readable names, for debugging only. |

Combine them for a precise stack frame on a failing route:

```bash
next build --debug-prerender --debug-build-paths="app/recipes/[slug]/page.tsx"
```

Read the route table: `○` static, `ƒ` dynamic; without Cache Components also `●` SSG; with
`cacheComponents: true` also `◐` partial prerender. With Cache Components, a "blocking prerender" error means
request-time data (`params`, `cookies()`, `headers()`, uncached fetch) was accessed outside `<Suspense>`. Fix by
streaming, caching (`'use cache'`) or explicitly allowing blocking; see
[suspense-boundaries.md](suspense-boundaries.md) and [data-patterns.md](data-patterns.md). `next dev` shows
the same validation errors in the overlay with source-mapped frames, and reruns them as you edit.

## 3. Logging (`next.config` `logging`, dev only)

```ts
// next.config.ts
import type { NextConfig } from 'next'

const config: NextConfig = {
  logging: {
    fetches: { fullUrl: true, hmrRefreshes: true }, // log full URLs, include HMR-cache hits
    browserToTerminal: true, // forward all browser console output (default 'warn')
    incomingRequests: { ignore: [/\/api\/health/] },
    // serverFunctions: false  // Server Function calls are logged by default
  },
}
export default config
```

Browser logs arrive as `[browser] message (app/file.tsx:line:col)`. `logging: false` silences dev logging.

## 4. Debuggers

- Server code: `npm run dev -- --inspect` (or `pnpm dev --inspect`), then `chrome://inspect`. For `--inspect-brk`
  use `NODE_OPTIONS=--inspect-brk next dev`. In Docker, `--inspect=0.0.0.0`.
- The error overlay shows a Node.js icon that copies the server DevTools URL.
- Client code: browser DevTools Sources tab, `debugger` statements, React Developer Tools.
- VS Code: a `node-terminal` launch config running `npm run dev -- --inspect` for server code, plus a `chrome`
  config pointing at `http://localhost:3000`. Add `cwd` for monorepo apps.

## 5. Dev environment facts

- `next dev` writes to `.next/dev`, so `next dev` and `next build` can run concurrently; a lockfile prevents
  two `next dev` (or two `next build`) on the same project.
- `devIndicators: { position: 'bottom-right' }` moves the route indicator; `false` hides it (errors still show).
  If a route you expected to be static shows as dynamic, check `next build` output for `ƒ`.
- `next info` (`--verbose`) prints OS, Node, package versions and config for bug reports.
- `next typegen && tsc --noEmit` type-checks typed routes without a build (output in `.next/dev/types` or
  `.next/types`).
- `PORT` cannot be set in `.env`; use `-p` or the shell environment.
- `next dev --experimental-https` creates a self-signed cert for webhook/auth testing.

## 6. Slow dev server or builds

**Do**
- Profile CPU with `--experimental-cpu-prof` on `dev`/`build`/`start` (files land in `.next-profiles/`; for
  dev, open `dev-server-*`).
- Trace Turbopack: `next dev --internal-trace`, reproduce, stop, then
  `npx next internal trace .next-profiles/trace-turbopack.bin` and open trace.nextjs.org.
- Exclude the project from antivirus scanning; on Windows use Dev Drive or keep code inside WSL 2's filesystem.
- Import icons from their per-icon paths and avoid barrel files. See [bundling.md](bundling.md).

**Avoid**
- Developing inside Docker Desktop on Mac/Windows with host-mounted source (slow, unreliable file events).
- `watchOptions.pollIntervalMs` except as a last resort.

## Sources
Official documentation, accessed 2026-10-20 (Next.js 16.4 docs):
- https://nextjs.org/docs/app/guides/mcp
- https://nextjs.org/docs/app/guides/debugging
- https://nextjs.org/docs/app/api-reference/cli/next
- https://nextjs.org/docs/app/guides/building
- https://nextjs.org/docs/app/api-reference/config/next-config-js/logging
- https://nextjs.org/docs/app/api-reference/config/next-config-js/devIndicators
- https://nextjs.org/docs/app/guides/local-development
- https://nextjs.org/docs/app/guides/upgrading/version-16
