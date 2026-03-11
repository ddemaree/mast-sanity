# Astro Migration Research

Research into adapting the Mast Sanity frontend from Next.js to Astro, with React component reuse via `@astrojs/react`.

## Core Insight

Astro can render Corey's entire React component tree (Section → Row → Column → blocks) to static HTML at build time via `@astrojs/react`, with no rewrites. In draft mode, the same tree hydrates as a single React island for live editing via Sanity's Presentation tool.

## Architecture

### Production (Static) Path

Astro server-renders the full React component tree to HTML and ships zero JavaScript for pure-presentation blocks.

```astro
---
// [slug].astro
const page = await sanityFetch(getPageQuery, { slug })
const isDraft = Astro.cookies.has('__sanity_draft')
---

{isDraft ? (
  <LivePageBuilder client:load page={page} />
) : (
  <PageBuilder page={page} />
)}
```

Both paths use the **same React components** — the only difference is whether Astro hydrates them.

Interactive blocks (tabs, accordion, slider, modal, marquee) need `client:visible` islands even in production for end-user interactivity. This is a net win over Next.js, which hydrates the entire page.

### Draft/Presentation Mode Path

When the Presentation tool iframe loads with draft mode active, a single `client:load` React island wraps the whole page builder. Inside it:

- `<VisualEditing>` from `@sanity/visual-editing/react` — overlays, stega click-to-edit, postMessage bridge to Studio
- `useOptimistic` from `@sanity/visual-editing/react` — instant updates via iframe postMessage channel (same mechanism as Next.js, same speed)
- Custom overlay components — already import from `@sanity/visual-editing/unstable_overlay-components`, not from `next-sanity`

**The Presentation mode editing experience would be functionally equivalent to Next.js.** The `useOptimistic` hook receives mutations through the iframe postMessage channel, not through the Sanity API.

## Dependency Analysis

### `next-sanity` is a thin wrapper

Almost everything `next-sanity` provides comes from lower-level, framework-agnostic packages:

| `next-sanity` import | Actual source | Works in Astro? |
|---|---|---|
| `VisualEditing` | `@sanity/visual-editing/react` | Yes — React island |
| `useOptimistic` | `@sanity/visual-editing/react` | Yes — React island |
| `useIsPresentationTool` | `@sanity/visual-editing/react` | Yes — React island |
| `stegaClean` | `@sanity/client/stega` | Yes — anywhere |
| `createDataAttribute` | `@sanity/visual-editing-csm` | Yes — anywhere |
| `PortableText` | `@portabletext/react` | Yes — React island |
| `createClient` | `@sanity/client` | Yes — anywhere |
| `defineOverlayComponents` | `@sanity/visual-editing/unstable_overlay-components` | Yes — React island |
| **`defineLive` / `sanityFetch` / `SanityLive`** | **next-sanity itself** | **No — the one real gap** |

### The one real gap: `defineLive` / `sanityFetch` / `SanityLive`

These are Next.js-only. They handle:

1. Server-side GROQ fetching with draft-mode-aware perspective switching
2. Real-time content revalidation via Next.js `revalidateTag`

**Replacements in Astro:**

For (1), a thin wrapper:

```ts
async function sanityFetch(query: string, params: Record<string, unknown> = {}) {
  const isDraft = /* check cookie/context */
  return client.fetch(query, params, {
    perspective: isDraft ? 'drafts' : 'published',
    stega: isDraft,
  })
}
```

For (2), production content freshness options:
- **SSG + webhook rebuild** — Sanity webhook triggers `astro build` (seconds delay, simplest)
- **SSR on-demand** — Every request hits Sanity (always fresh, no caching logic)
- **Hybrid** — Static pages with targeted invalidation

For a design system marketing site, SSG + webhook rebuild is the obvious choice.

## Migration Checklist

### Required Changes (small surface area)

1. **`next/image` → `<img>`** (~9 files)
   - Continue using `urlForImage` from `@sanity/image-url` for Sanity CDN transforms (resize, format, crop/hotspot)
   - Use `loading="lazy"` for lazy loading
   - Existing `getBlurDataUrl` helper still works for blur placeholders

2. **`next/link` → `<a href>`** (~10 files)
   - No SPA navigation needed — standard links work fine
   - Files: Header, FooterNew, PageBuilder, Navigation, ResolvedLink, Posts, card, breadcrumb, BlogGridBlock, Onboarding

3. **`sanityFetch` wrapper** (1 new file)
   - Replace `defineLive`-based `sanityFetch` with direct `@sanity/client` fetch
   - Toggle `perspective` and `stega` based on draft cookie

4. **Draft mode endpoint** (1 new file)
   - Astro API endpoint that validates Sanity's preview secret and sets a cookie
   - Replaces `defineEnableDraftMode` from `next-sanity/draft-mode`

5. **`VisualEditing` import swap** (1 file)
   - `next-sanity/visual-editing` → `@sanity/visual-editing/react`
   - Same component, just a different import path

6. **`next/dynamic` → Astro `client:*` directives** (1 file, `ContentBlockRenderer.tsx`)
   - Tabs, slider, modal are currently dynamically imported via `next/dynamic`
   - In the static path, wrap with `client:visible` for end-user interactivity
   - In the draft island, they hydrate naturally as part of the `client:load` tree

### Directly Reusable (zero changes)

- **All GROQ queries** (`queries.ts`) — pure strings
- **All React block components** — rendered by Astro via `@astrojs/react`, same JSX
- **Custom overlay system** — `CustomOverlay.tsx`, `ComponentLabelPlugin.tsx` already use `@sanity/visual-editing/unstable_overlay-components`
- **`postMessage` bridge to Claude assistant** — `BlockContextBridge.tsx` uses plain `window.postMessage`
- **Design tokens / CSS** — `globals.css` is pure CSS custom properties + Tailwind v4
- **`parseCustomStyle`**, **`resolveContentVariable`** — pure utility functions
- **`@sanity/image-url`** / **`@sanity/asset-utils`** — framework-agnostic

### Studio Side: Zero Changes

The Sanity Studio is completely independent. Claude assistant, Pinboard, section template picker, custom structure — all work regardless of frontend framework. The Presentation tool just needs an iframe URL that responds to its protocol.

## Next.js Coupling Points (full inventory)

### Tier 1 — Must replace (Next.js-only APIs)

| Import | Files | Replacement |
|---|---|---|
| `next-sanity/live` (`defineLive`, `sanityFetch`, `SanityLive`) | 1 | Custom `sanityFetch` wrapper |
| `next-sanity/draft-mode` (`defineEnableDraftMode`) | 1 | Astro API endpoint |
| `next-sanity/visual-editing` (`VisualEditing`) | 1 | `@sanity/visual-editing/react` |
| `next-sanity/hooks` (`useDraftModeEnvironment`) | 1 | Custom hook or remove |
| `next/headers` (`draftMode`) | 6 | Astro cookies/middleware |
| `next/navigation` (`redirect`, `notFound`, `useRouter`, `useSearchParams`) | 5 | Astro redirects, 404 pages, browser APIs |
| `next/server` (`NextRequest`, `NextResponse`) | 6 | Astro API endpoint types |
| `next/font/local` | 1 | CSS `@font-face` |
| `next/dynamic` | 1 | Astro `client:*` directives |
| `next/image` | 9 | `<img>` + Sanity CDN |
| `next/link` | 10 | `<a href>` |

### Tier 2 — Re-exported by `next-sanity`, use original source

| Import | Actual source |
|---|---|
| `createClient` | `@sanity/client` |
| `stegaClean` | `@sanity/client/stega` |
| `createDataAttribute` | `@sanity/visual-editing-csm` |
| `defineQuery`, `groq` | `groq` |
| `PortableText` | `@portabletext/react` |
| `toPlainText` | `@portabletext/toolkit` |
| `useOptimistic`, `useIsPresentationTool` | `@sanity/visual-editing/react` |

### Tier 3 — Already framework-agnostic (no changes needed)

| Package | Usage |
|---|---|
| `@sanity/client` | Direct usage in API routes, BlogGridBlock |
| `@sanity/image-url` | Image URL builder |
| `@sanity/asset-utils` | Image dimensions |
| `@sanity/visual-editing/unstable_overlay-components` | Custom overlays |
| `@sanity/uuid` | UUID generation |

## Benefits Over Next.js

1. **Zero JS for static content** — Most blocks ship no JavaScript. Next.js hydrates everything.
2. **Targeted hydration** — Only interactive blocks (tabs, accordion, slider, modal) get `client:visible` islands.
3. **Simpler mental model** — No RSC/client component boundary confusion, no `'use client'` directives.
4. **Deployment flexibility** — SSG to any static host, SSR via any Node/edge runtime, or hybrid.
5. **Smaller bundle** — No React runtime for pages that are pure content.

## Open Questions

- **`BlogGridBlock` client-side fetching**: Currently creates its own `@sanity/client` instance and fetches on the client. This pattern works as-is in a React island, but could also be moved to Astro's server-side fetch for better performance.
- **`useSearchParams` in `ModalBlock`**: Used for URL-driven modal state (`?modal=id`). Would need a small React hook using `window.location` or `URLSearchParams` directly.
- **Font loading**: `next/font/local` does font optimization (preload, CSS variable injection). Replace with standard `@font-face` declarations and `<link rel="preload">` in the Astro layout.
- **Sitemap generation**: Currently uses Next.js `sitemap.ts` convention. Replace with `@astrojs/sitemap` integration or a custom endpoint.
- **API routes**: The Claude and Figma API routes (`/api/claude/*`, `/api/figma/*`) use Next.js Route Handlers. These would become Astro API endpoints with minimal changes (swap `NextRequest`/`NextResponse` for Astro's `APIRoute` pattern).
