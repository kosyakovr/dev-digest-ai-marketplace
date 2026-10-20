# Fonts (`next/font`)

How to load web fonts in a Next.js 16 App Router app with `next/font/google` and `next/font/local`:
self-hosted, preloaded where needed, and without layout shift.

## What `next/font` does for you

- Google Fonts: CSS and font files are downloaded at **build time** and served from your own domain.
  The browser never contacts Google, so do not add `<link href="https://fonts.googleapis.com/...">` tags.
- Local fonts: any font file is self-hosted the same way; `src` is resolved relative to the file that calls `localFont`.
- An automatic fallback font with adjusted metrics reduces Cumulative Layout Shift (`adjustFontFallback`).

## Rules

**Do**
- Define each font **once** in a shared module (e.g. `app/fonts.ts`) and import the exported object
  wherever it is needed. Every loader call creates a separate hosted instance.
- Call the loader at module top level and assign the result to a `const` (recommendation, matching every
  documented example).
- Prefer variable fonts; then `weight` can be omitted (or given as a range like `'200 800'`).
- For non-variable fonts, list the weights you actually use: `weight: ['400', '700']`.
- Set `subsets` for Google fonts (e.g. `['latin']`). With `preload` on (the default), a missing subset triggers a warning.
- Apply the global font in the **root layout** so it is preloaded on every route.
- Use the `variable` option plus CSS variables when styling from CSS files or Tailwind.

**Avoid**
- Calling the same font loader in several components; that duplicates the font.
- Loading many families or weights "just in case"; each is another download.
- Multi-word Google names with spaces. Import them with underscores: `Roboto_Mono`, `Source_Sans_3`.
- Shipping a non-Latin font with `preload: true` but no matching subset. Pick the subset or set `preload: false`.

## Shared font module

```ts
// app/fonts.ts
import { Fraunces, JetBrains_Mono } from 'next/font/google'
import localFont from 'next/font/local'

export const fraunces = Fraunces({ subsets: ['latin'], display: 'swap', variable: '--font-fraunces' })

export const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' })

export const brand = localFont({
  src: [
    { path: './fonts/Ledger-Regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/Ledger-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-brand',
  adjustFontFallback: 'Times New Roman', // local fonts: 'Arial' (default), 'Times New Roman' or false
})
```

```tsx
// app/layout.tsx
import { fraunces, mono, brand } from './fonts'
import './globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${mono.variable} ${brand.variable}`}>
      <body className={fraunces.className}>{children}</body>
    </html>
  )
}
```

## Tailwind CSS (v4)

Expose the font variables to Tailwind's theme in your global stylesheet, then use `font-serif`, `font-mono`:

```css
/* app/globals.css */
@import 'tailwindcss';

@theme inline {
  --font-serif: var(--font-fraunces);
  --font-mono: var(--font-jetbrains);
  --font-display: var(--font-brand);
}
```

Tailwind v3 projects map the variables in `theme.extend.fontFamily` in `tailwind.config.js` instead.

## Three ways to apply a font

| Method | Use when |
| --- | --- |
| `font.className` | Applying a family directly to an element or subtree |
| `font.style` | You need an inline style object (`style.fontFamily` includes the fallbacks) |
| `font.variable` + `var(--name)` | Styling from CSS Modules, global CSS or Tailwind |

## Key options

| Option | Notes |
| --- | --- |
| `display` | Default `'swap'`. `'optional'` minimizes layout shift if a late swap is not important. |
| `preload` | Default `true`. Applies to every file of that loader call. |
| `subsets` | Google only. Determines which subsets get a preload `<link>`. |
| `axes` | Google variable fonts only; extra axes beyond weight (e.g. `slnt`) add bytes. |
| `fallback` | Your own fallback stack, e.g. `['system-ui', 'arial']`. |
| `adjustFontFallback` | Google: boolean (default `true`). Local: `'Arial'` (default), `'Times New Roman'` or `false`. |
| `declarations` | Local only: extra `@font-face` descriptors. Setting `font-family` replaces the generated name. |

## Preloading scope

A font is preloaded only on routes where it is used: a page's font on that route, a layout's font on all
routes under the layout, a root-layout font on every route. Importing a heading font only in
`app/blog/layout.tsx` keeps it off the rest of the site.

Give `next/font` variables names that differ from Tailwind theme keys (as above) so `@theme` never references itself
(recommendation). Related: CSS import rules in [bundling.md](bundling.md).

## Sources
Official documentation, accessed 2026-10-20 (Next.js 16.4 docs):
- https://nextjs.org/docs/app/getting-started/fonts
- https://nextjs.org/docs/app/api-reference/components/font
- https://nextjs.org/docs/messages/google-fonts-missing-subsets
- https://nextjs.org/docs/messages/google-font-display
