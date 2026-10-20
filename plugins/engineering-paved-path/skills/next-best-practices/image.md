# Images (`next/image`)

How to render images in a Next.js 16 App Router app so they are sized right, do not shift layout,
and pass the stricter v16 image-optimizer defaults.

## Core rules

**Do**
- Import `Image` from `next/image` for content images; always pass `alt` (`alt=""` for purely decorative images).
- Prefer static imports for local files: width, height and (for jpg/png/webp/avif) `blurDataURL` are filled in for you, and the file gets a content-hashed, long-cached URL.
- For remote or string paths, pass `width` and `height` (intrinsic size, used for the aspect ratio, not the rendered size) or use `fill`.
- Pass `sizes` whenever the image is `fill` or made responsive with CSS. Without it the browser assumes `100vw` and may download a much larger file.
- With `fill`, give the parent `position: relative` (or `fixed`/`absolute`) and set `objectFit` (`cover`/`contain`).
- Use `preload` only for the single LCP/hero image. `priority` is deprecated since v16.
- Put `onLoad`, `onError` or a `loader` function inside a Client Component; functions cannot cross the server-to-client boundary (see [rsc-boundaries.md](rsc-boundaries.md)).

**Avoid**
- `next/legacy/image` (deprecated) and the `onLoadingComplete` prop (deprecated, use `onLoad`).
- Setting a CSS `width` via `style` without `height: 'auto'`; the aspect ratio breaks.
- Marking several images `preload`, or combining `preload` with `loading`/`fetchPriority`. The docs suggest `loading="eager"` or `fetchPriority="high"` is often the better tool.
- Passing `srcSet` yourself; it is not forwarded. Tune `deviceSizes`/`imageSizes` instead.

```tsx
// app/recipes/[slug]/page.tsx
import Image from 'next/image'
import heroPhoto from './pancakes.jpg' // static import: size + blur placeholder automatic

export default function RecipePage() {
  return (
    <>
      <Image src={heroPhoto} alt="Stack of blueberry pancakes" placeholder="blur" preload />
      <Image
        src="https://cdn.recipes.example/steps/step-1.webp"
        alt="Whisking the batter"
        width={800}
        height={533}
      />
    </>
  )
}
```

## Responsive images with `fill` + `sizes`

```tsx
// app/bookshelf/book-cover.tsx
import Image from 'next/image'

export function BookCover({ src, title }: { src: string; title: string }) {
  return (
    <div style={{ position: 'relative', aspectRatio: '2 / 3' }}>
      <Image
        src={src}
        alt={`Cover of ${title}`}
        fill
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 200px"
        style={{ objectFit: 'cover' }}
      />
    </div>
  )
}
```

`sizes` also changes the generated `srcset`: with `sizes` you get the full width list (`deviceSizes` +
`imageSizes`); without it a fixed-width image only gets 1x/2x candidates.

If a file cannot be statically imported but lives in the repo, a Server Component can `await import()` it with
a static path prefix and still get width, height and `blurDataURL`. Every file under that prefix is bundled, so
keep the prefix narrow.

## Remote images: `remotePatterns`

`images.domains` is deprecated. Allow-list remote sources with `remotePatterns`, as narrowly as possible;
unmatched URLs get `400 Bad Request` from the optimizer.

```ts
// next.config.ts
import type { NextConfig } from 'next'

const config: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.recipes.example', pathname: '/steps/**', search: '' },
      new URL('https://covers.bookshelf.example/public/**'),
    ],
  },
}
export default config
```

Omitting `protocol`, `port`, `pathname` or `search` implies a `**` wildcard, which is too permissive. `*` matches
one segment/subdomain; `**` matches many, but only at the end of a path or start of a hostname. The optimizer
does not forward request headers, so images behind auth need `unoptimized`.

## Next.js 16 default changes (check these when upgrading)

| Setting | v16 behavior |
| --- | --- |
| `images.qualities` | Defaults to `[75]`. A `quality` prop outside the list is coerced to the nearest allowed value; direct `/_next/image` requests with other `q` values return 400. |
| `images.minimumCacheTTL` | Default raised from 60 s to 14400 s (4 hours). |
| `images.imageSizes` | `16` removed: default is `[32, 48, 64, 96, 128, 256, 384]`. |
| `images.localPatterns[].search` | Local `src` values with a query string (e.g. `/logos/brand.png?v=3`) must be allowed via `localPatterns` with a matching `search`. |
| `images.dangerouslyAllowLocalIP` | New, `false` by default: images resolving to local/private IPs are blocked. Enable only on private networks, aware of SSRF risk. |
| `images.maximumRedirects` | Default is now 3 (was unlimited); `0` disables redirects. |
| `preload` prop | Added; replaces deprecated `priority`. |

Need another quality? Add it explicitly: `images: { qualities: [60, 75, 90] }`.

## Loaders, `unoptimized`, SVG

- Custom CDN: set `images: { loader: 'custom', loaderFile: './lib/image-loader.ts' }`. The file default-exports
  `({ src, width, quality }) => string` and needs `'use client'`. Per-image, use the `loader` prop instead.
- `unoptimized` serves the source as-is (per image, or `images.unoptimized: true` globally), useful for tiny
  images, GIFs, and SVGs.
- SVG: the optimizer does not process SVGs by default, and an `src` ending in `.svg` is automatically treated
  as unoptimized. Only set `dangerouslyAllowSVG: true` together with `contentDispositionType: 'attachment'`
  and a restrictive `contentSecurityPolicy`.
- `formats` defaults to `['image/webp']`; add `'image/avif'` first if you accept slower first encodes. Behind
  your own proxy/CDN, forward the `Accept` header.
- `getImageProps()` returns `<img>` props for art direction with `<picture>` or CSS backgrounds (no `placeholder`).

Self-hosting the optimizer (disk cache size, `sharp`) is covered in [self-hosting.md](self-hosting.md).

## Sources
Official documentation, accessed 2026-10-20 (Next.js 16.4 docs):
- https://nextjs.org/docs/app/getting-started/images
- https://nextjs.org/docs/app/api-reference/components/image
- https://nextjs.org/docs/app/api-reference/config/next-config-js/images
- https://nextjs.org/docs/app/guides/upgrading/version-16
