# Implementation plan: extract the Mast page builder into `packages/mast-blocks` + add an Astro consumer

Repo: `/Users/david/Developer/mast-sanity` (fork of `CoreyMoen/mast-sanity`; remote `upstream`).
Baseline: `upstream/main` = commit `22230fe`. Everything in this plan was verified against that commit with `git show upstream/main:<path>` / `git grep <pat> upstream/main`. Do NOT plan or diff against the local branch `refactor/turbo-monorepo-and-docker` — it is abandoned.

The goal: move the page-builder React component tree out of `frontend/` into a shared workspace package (`packages/mast-blocks`) behind a host-adapter interface, then add an Astro workspace as a second consumer. Portability is the point: no Next-only API may remain in the package. The Astro app is the forcing function that proves it.

Environment constraints (from repo CLAUDE.md):

- `npx tsx` does not work on this machine. Any utility script must be a `.mjs` ES module run with plain `node`.
- Verification without servers: `npm run type-check` / `npx tsc --noEmit`.
- Node >= 22.12 required (root `engines`).
- Dev ports in use: frontend 3001, Studio 3334.

---

## 0. Corrections to prior analysis (verified 2026-08-15 against `upstream/main`)

The handoff analysis was done on a slightly older tree. These points were re-verified; where the old numbers were wrong, the corrected fact is below. Trust this section over older docs.

1. **CSS file is `frontend/app/globals.css` (1,028 lines), not `frontend/app/app.css`** as the project CLAUDE.md says. It contains the full Tailwind v4 `@theme` block, 14 `@utility` definitions (`container`, `text-h1`…`text-eyebrow`, `section-padding`, `card-padding`), and app CSS. There IS a `frontend/tailwind.config.ts`, but it is vestigial: `globals.css` has no `@config` directive, so Tailwind v4's PostCSS plugin never loads it — v4 automatic source detection is what's actually scanning the app.
2. **`next-sanity/hooks` also exports `useVisualEditingEnvironment`**, used by `frontend/app/components/DraftModeToast.tsx` (the old research doc calls it `useDraftModeEnvironment` — renamed). DraftModeToast stays in the Next app, so this is informational.
3. **The visual-editing re-export chain holds for next-sanity 13 / Sanity v6.** Verified from the npm registry: `next-sanity@13.1.3` depends on `@sanity/visual-editing@^5.5.0` and `@sanity/client@^7.23.1`. Verified from `@sanity/visual-editing`'s export map and `dist/react/index.d.ts`: `@sanity/visual-editing/react` exports `VisualEditing`, `useOptimistic`, `useIsPresentationTool`, `useVisualEditingEnvironment`, `createDataAttribute`, and type `CreateDataAttributeProps`. `createDataAttribute` is also available at the dedicated subpath `@sanity/visual-editing/create-data-attribute`. `stegaClean` lives at `@sanity/client/stega`. `defineQuery` lives in the `groq` package. `PortableText` lives in `@portabletext/react`. Seams 3 and 4 are therefore mechanical — no `@sanity/visual-editing-csm` direct dependency is needed.
4. **`next/image` files inside `frontend/` on upstream/main: 11**, of which 6 are in the page-builder closure (`blocks/Section.tsx`, `blocks/ImageBlock.tsx`, `blocks/SliderBlock.tsx`, `blocks/BlogGridBlock.tsx`, `ui/card.tsx`, `ui/inline-video.tsx`) — note **SliderBlock also uses `next/image`**, which the handoff list omitted. The other 5 stay in the app (`FooterNew`, `Header`, `Navigation`, `Posts`, `posts/[slug]/page.tsx`). Plus `next-sanity/image` in `Avatar.tsx` and `CoverImage.tsx` (both stay in the app).
5. **`stegaClean` from `next-sanity` appears in 23 files**: all 22 block files under `frontend/app/components/blocks/` except `Column.tsx`… correction: including `Column.tsx`, `Row.tsx`, `Section.tsx`, `ContentWrap.tsx` — i.e. every block file that isn't `ContentBlockRenderer.tsx`/`index.ts` — plus `frontend/app/lib/resolveContentVariable.ts`. The full per-file list is in Phase 1.
6. **`'use client'` blocks (9, confirmed):** BlogGridBlock, BreadcrumbBlock, EyebrowBlock, InlineVideoBlock, MarqueeBlock, ModalBlock, SliderBlock, TableBlock, TabsBlock. Also client: 6 `ui/` files (accordion, inline-video, marquee, modal, slider, tabs, theme-toggle) and all 7 `overlays/` files.
7. **The whole block tree is already client-rendered in Next.** `PageBuilder.tsx` is `'use client'` and statically imports `BlockRenderer` → `Section` → everything. So React context is usable anywhere in the tree today — the adapter can be context-based without changing Next's rendering model. The one exception: `frontend/app/preview/template/[id]/page.tsx` imports `Section` directly from a **server** component. After the adapter refactor it needs a small client wrapper (Phase 2).
8. **Studio already supports pointing Presentation at another origin**: `studio/sanity.config.ts` line 31 reads `SANITY_STUDIO_PREVIEW_URL` (default `http://localhost:3001`). Testing the Astro app in Presentation is an env var, not a Studio change.
9. **`BlogGridBlock.tsx` builds its GROQ inline** (its own `postFields` fragment and its own `createClient` from `NEXT_PUBLIC_*` env vars, `useCdn: true`, published perspective). The `blogGrid*Query` exports in `frontend/sanity/lib/queries.ts` exist for typegen but are not imported by the block.
10. **`frontend/app/types/blocks.ts` imports `SanityImageAsset` from `@/sanity.types`** and `PageBuilder.tsx` imports `GetPageQueryResult`. These are the only generated-type dependencies inside the closure — they drive decision D4.
11. **`dataAttr` / `urlForImage` / `getBlurDataUrl` / `linkResolver` all live in `frontend/sanity/lib/utils.ts`**, which reads `projectId`/`dataset`/`studioUrl` from `frontend/sanity/lib/api.ts`, which reads `NEXT_PUBLIC_*` env vars and throws when missing. The package cannot read `NEXT_PUBLIC_*` (Astro exposes `PUBLIC_*`); config must be injected (adapter seam 5, below).
12. `frontend/next.config.ts` contains a hardcoded `turbopack.root: '/Users/corey/code/personal/mast-sanity'`. It appears to work regardless on this machine, but if Turbopack complains after the reset, this is why — fix is to delete the `turbopack` block or point it at the real root. Not otherwise part of this plan.

Prior art: `git show origin/astro-migration-research:docs/astro-migration-research.md` — a sound March 2026 inventory of the Next coupling and an Astro architecture sketch. Read it once for orientation; the corrections above and the file lists below supersede its counts. Its one architectural gap: it implies individual blocks inside a server-rendered React tree can be selectively hydrated in Astro. They cannot — Astro island boundaries exist only at `.astro` template level. Phase 5 designs around this (per-section islands).

---

## 1. Non-goals

Explicitly out of scope. Do not touch these except where a phase says so.

- **Docker**: `frontend/Dockerfile`, `studio/Dockerfile`, per-app `docker-compose.yml` are stale (studio image is Node 20, which violates `engines: >=22.12`; `npm install --legacy-peer-deps`). Leave them. Note in the PR description that this work makes them drift further (they COPY paths that will still exist, but they know nothing about `packages/`, so Docker builds of `frontend` will fail to resolve `@mast/blocks` until someone refreshes them).
- **Bun / Turborepo**: the abandoned branch's territory. Stay on plain npm workspaces + `npm-run-all2`.
- **Sanity Studio changes**: none. The Studio, its Claude assistant, Pinboard, section templates are untouched. (`SANITY_STUDIO_PREVIEW_URL` is an env var, not a code change.)
- **The Claude/Figma API routes** (`frontend/app/api/claude/*`, `frontend/app/api/figma/*`): stay in the Next app unchanged. The Astro app does not get them.
- **Tailwind-to-vanilla-CSS work**: lives on another branch; irrelevant here.
- **Publishing the package to npm**: it stays a private workspace package.

---

## 2. Decisions

Each decision below has a recommendation. Implement the recommendation unless David says otherwise; the alternatives are recorded so the tradeoff is visible.

### D1. Package name and scope

**Recommendation: `@mast/blocks`, directory `packages/mast-blocks`, `"private": true`.**
Neutral scope, short import paths (`@mast/blocks`, `@mast/blocks/queries`). If it later publishes for Rill Data work, renaming a private package is a find/replace. Alternative: `@bitsandletters/mast-blocks` — future-proofs npm publishing but noisier imports for no benefit now.

### D2. Workspace layout

**Recommendation: keep `studio/` and `frontend/` at the top level; add `packages/*` and `astro-app` to the root `workspaces` array**: `["studio", "frontend", "packages/*", "astro-app"]`.
Rationale: upstream merges. Corey's repo will keep evolving `studio/` and `frontend/`; every future `git merge upstream/main` gets cheaper the less those paths move. An `apps/` reshuffle (moving `frontend` → `apps/next`) would be tidier but converts every upstream commit into a rename-tracking merge. Do not move `frontend` or `studio`.

### D3. Source package vs. built package

**Recommendation: ship TypeScript source ("internal package" pattern).** `package.json` `exports` point at `./src/*.ts(x)`; no build step, no dist.

- Next consumes it via `transpilePackages: ['@mast/blocks']` in `frontend/next.config.ts`.
- Astro/Vite compiles workspace TS natively.
- The package gets its own `tsconfig.json` and a `type-check` script (`tsc --noEmit`) so it has an independent correctness gate — root `npm run type-check --workspaces` picks it up automatically.
  Tradeoff: no compiled artifact means consumers must be able to compile TS + `'use client'` banners (both can; Vite emits a harmless "module level directive" warning it's configured to silence, see Phase 5). A built package would isolate consumers from TS config drift but adds a watch/build step to every dev loop and a place for staleness bugs. Not worth it for two in-repo consumers.

### D4. GROQ queries and generated Sanity types

**Recommendation: queries move into the package; typegen and the generated types file stay owned by `frontend/`; the package itself is typegen-free and uses structural types.**
Concretely:

- `frontend/sanity/lib/queries.ts` moves to `packages/mast-blocks/src/queries.ts`, with `defineQuery` imported from `groq` instead of `next-sanity`. Query strings must be byte-identical after the move. `frontend/sanity/lib/queries.ts` becomes a one-line re-export (`export * from '@mast/blocks/queries'`) so app imports don't churn — or app imports are updated and the file deleted; prefer the re-export to keep the upstream-merge surface small.
- `frontend/sanity-typegen.json` `path` becomes an **array**: `["./sanity/**/*.{ts,tsx,js,jsx}", "../packages/mast-blocks/src/**/*.{ts,tsx}"]`. (`sanity typegen` documents `path` as string-or-array; **verify-first spike in Phase 3** — run `npm run typegen --workspace=frontend` immediately after editing and diff the output.)
- `generates` stays `./sanity.types.ts` → `frontend/sanity.types.ts` is still the single generated file; the CI staleness check (`git diff --exit-code studio/schema.json frontend/sanity.types.ts`) keeps working with **zero ci.yml path changes**.
- The package does **not** import `frontend/sanity.types.ts` (a package importing from its consumer is a cycle). The two closure dependencies on generated types are removed: `types/blocks.ts` replaces the `SanityImageAsset` import with a structural equivalent (it already defines `SanityImageSource` structurally; extend that), and `PageBuilder.tsx` types its `page` prop with a package-defined structural interface (`MastPage`, below) instead of `GetPageQueryResult`. The Next app keeps using `GetPageQueryResult` at the call site and passes it in — it is structurally compatible; if TS balks on exactness, cast at the boundary in `frontend/app/[slug]/page.tsx` / `page.tsx` (already casts today: `page as GetPageQueryResult`).
  Tradeoff: the package's block prop types are hand-maintained structural types (they already are — `frontend/app/types/blocks.ts` exists precisely for this), so schema drift shows up at runtime rather than compile time inside the package. The alternative — generating types into the package and re-exporting — makes the package the typegen owner, forces `sanity.cli.ts`/CLI plumbing into the package, and changes the CI staleness paths; more moving parts for marginal safety. Astro can later run its own typegen if it wants query-result types; not required.

### D5. Tailwind v4 tokens and CSS

**Recommendation: the design tokens and block-facing utilities move into the package as a plain CSS file consumers import; each consumer keeps its own Tailwind entry and adds an explicit `@source` for the package.**
Concretely:

- Create `packages/mast-blocks/src/styles/mast.css` containing, extracted verbatim from `frontend/app/globals.css`: the entire `@theme { … }` block, all 14 `@utility` blocks, and any component classes the moved components reference (grep the moved sources for class names defined in `globals.css` outside `@theme`/`@utility` — e.g. button/eyebrow/card CSS if present — and move those too). Do **not** include `@import 'tailwindcss'` in the package file; the consumer owns that.
- `frontend/app/globals.css` becomes: `@import 'tailwindcss';` + `@plugin "@tailwindcss/typography";` + `@import '@mast/blocks/styles.css';` + `@source "../../packages/mast-blocks/src";` + whatever app-only CSS remains (pinboard-mode rules, page-level styles).
- The `@source` line is load-bearing: Tailwind v4 auto-detection skips `node_modules`, and the workspace symlink means package sources otherwise never get scanned — utilities used only by package components would silently vanish from the built CSS. Same directive (with its own relative path) goes in the Astro app's CSS entry.
- Delete `frontend/tailwind.config.ts` (verified vestigial — no `@config` directive loads it) or leave it with a comment; deleting is cleaner, leaving it is cheaper for upstream merges. Leave it.
  Tradeoff: tokens-in-package means a consumer can't diverge its brand without overriding tokens after the import — which is exactly the intended "reusable starter" behavior. Keeping tokens per-consumer would duplicate 400+ lines of `@theme` and guarantee drift.

### D6. Astro workspace name, location, port

**Recommendation: top-level `astro-app/` workspace (npm name `astro-app`), dev port `3002` (`astro dev --port 3002`).** 3001/3334 are taken; 3002 keeps the local numbering scheme. Astro's default 4321 also works; 3002 is just consistent. Package manager stays npm (single root lockfile).

### D7. Where the host adapter lives

**Recommendation: React context provided by the host, with the contract types owned by the package** (`packages/mast-blocks/src/host/`). Each consumer implements one adapter module: `frontend/app/lib/mast-adapter.tsx` (Next) and `astro-app/src/lib/mast-adapter.tsx` (Astro). Registry overrides ride on the same adapter object. Full API in §3.

### D8. Which components move

**Recommendation: move the full PageBuilder closure plus the framework-agnostic overlay system; keep site chrome and post components in the app.**

- Moves: everything in §4's inventory — `PageBuilder`, `BlockRenderer`, all `blocks/*`, 13 `ui/*` files, `PortableText.tsx`, `ResolvedLink.tsx`, the overlay components that are already framework-agnostic (`ContentBlockOverlay`, `ColumnOverlay`, `OverlayHoverContext`, `constants.ts`, `CustomOverlay.tsx`, `ComponentLabelPlugin.tsx`, `BlockContextBridge.tsx` — the last three use only `@sanity/visual-editing/unstable_overlay-components` and `window.postMessage`), the pure utils, and the Sanity helpers (`urlForImage`, `getBlurDataUrl`, `getImageWithBlur`, `linkResolver`, `dataAttr`).
- Stays in `frontend/`: `Header`, `Navigation`, `FooterNew`, `Footer`, `Posts`, `Avatar`, `CoverImage`, `Date`, `DraftModeToast`, `Onboarding`, `GetStartedCode`, `SideBySideIcons`, `ui/theme-toggle.tsx` (used only by app chrome and the design-system page; move later if the Astro app wants it), `overlays/VisualEditingWithPlugins.tsx` (imports `next-sanity/visual-editing`, which layers Next router-refresh behavior on top of the base `VisualEditing`; each host composes its own equivalent from package exports), all of `sanity/lib/` except the moved helpers (`api.ts`, `client.ts`, `live.ts`, `token.ts`, `demo.ts` stay).
  Rationale for keeping chrome out: Header/Footer/Navigation are site-shaped, not block-shaped, and they lean on `next/image`/`next/link` in ways the Astro app will reimplement natively anyway. The starter's unit of reuse is the page builder.

---

## 3. Adapter API design (the heart of the package)

All files below are new, under `packages/mast-blocks/src/host/`. Sketches are normative: two implementers following them should produce compatible code.

### 3.1 Contract types — `src/host/types.ts`

```ts
import type * as React from 'react'
import type {SanityClient} from '@sanity/client'

/** Serializable Sanity project config. No process.env reads inside the package. */
export interface MastSanityConfig {
  projectId: string
  dataset: string
  apiVersion: string
  /** Base URL of the Studio, used for edit-intent links and data attributes. */
  studioUrl: string
}

/**
 * Host-supplied image renderer.
 * `src` is always a finished Sanity CDN URL (urlForImage already applied
 * crop/hotspot/auto-format). The host decides how to optimize delivery.
 */
export interface MastImageProps {
  src: string
  alt: string
  /** Intrinsic dimensions; provided whenever fill is false. */
  width?: number
  height?: number
  /** Cover-position within a relatively-positioned parent (next/image fill semantics). */
  fill?: boolean
  sizes?: string
  className?: string
  style?: React.CSSProperties
  loading?: 'lazy' | 'eager'
  fetchPriority?: 'high' | 'auto'
  /** Tiny blurred data/CDN URL from getBlurDataUrl(); host may ignore. */
  blurDataURL?: string
  draggable?: boolean
}

/** Host-supplied link renderer. Superset of a plain anchor. */
export interface MastLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string
  /** Hint only; hosts without prefetch ignore it. */
  prefetch?: boolean
}

export type BlockProps<T extends {_key: string; _type: string} = any> = {
  block: T
  index: number
}
export type BlockComponent = React.ComponentType<BlockProps>
export type BlockRegistry = Record<string, BlockComponent>

export interface MastHostAdapter {
  Image: React.ComponentType<MastImageProps>
  Link: React.ComponentType<MastLinkProps>
  /** Reactive read of a URL search param (ModalBlock's ?modal=id). */
  useSearchParam: (key: string) => string | null
  sanity: MastSanityConfig
  /**
   * Client for blocks that fetch on the client (BlogGridBlock).
   * Published-perspective, CDN, no token. Required if blogGridBlock is used.
   */
  client?: SanityClient
  /** Per-host block substitutions merged over the default registry. */
  registryOverrides?: Partial<BlockRegistry>
  /** True only inside a draft-mode / Presentation render. Gates data-sanity attrs. */
  visualEditingEnabled?: boolean
}
```

### 3.2 Provider — `src/host/context.tsx` (`'use client'`)

```tsx
'use client'
import {createContext, useContext} from 'react'
import type {MastHostAdapter} from './types'

const MastHostContext = createContext<MastHostAdapter | null>(null)

export function MastHostProvider(props: {adapter: MastHostAdapter; children: React.ReactNode}) {
  return <MastHostContext.Provider value={props.adapter}>{props.children}</MastHostContext.Provider>
}

export function useMastHost(): MastHostAdapter {
  const host = useContext(MastHostContext)
  if (!host) throw new Error('mast-blocks components must be rendered inside <MastHostProvider>')
  return host
}
```

Component usage pattern (applies to every file that today imports `next/image`, `next/link`, `useSearchParams`, or reads env config):

```tsx
const {Image, Link, sanity, visualEditingEnabled} = useMastHost()
```

Because the whole tree already sits under the `'use client'` `PageBuilder` boundary in Next (correction #7), adding hooks to `Section`/`ImageBlock`/`card` costs nothing there. **Add an explicit `'use client'` directive to every moved component file that calls `useMastHost` or any hook** — it is a no-op where already implied, it makes the preview-template page's requirement visible, and it keeps the files honest as standalone modules.

### 3.3 Default search-param hook — `src/host/useWindowSearchParam.ts` (`'use client'`)

```ts
'use client'
import {useSyncExternalStore} from 'react'

/** Framework-free useSearchParam for hosts without a router hook (Astro). */
export function useWindowSearchParam(key: string): string | null {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener('popstate', onChange)
      window.addEventListener('mast:locationchange', onChange) // fired by modal open/close helpers
      return () => {
        window.removeEventListener('popstate', onChange)
        window.removeEventListener('mast:locationchange', onChange)
      }
    },
    () => new URLSearchParams(window.location.search).get(key),
    () => null, // server snapshot
  )
}
```

`ModalBlock` switches from `useSearchParams()` to `useMastHost().useSearchParam('modal')`. Wherever ModalBlock (or `ui/modal.tsx`) mutates the URL, it must dispatch `new Event('mast:locationchange')` after `history.pushState/replaceState` so the hook re-reads. The Next adapter supplies a wrapper over `next/navigation`'s `useSearchParams` instead (preserves Suspense-integrated behavior); the Astro adapter uses `useWindowSearchParam` as-is.

### 3.4 Block registry — `src/registry.tsx`

```tsx
import type {BlockRegistry} from './host/types'
import HeadingBlock from './blocks/HeadingBlock'
// … static imports of ALL 20 renderable types, including SliderBlock/TabsBlock/ModalBlock
export const defaultBlockRegistry: BlockRegistry = {
  headingBlock: HeadingBlock,
  richTextBlock: RichTextBlock,
  imageBlock: ImageBlock,
  buttonBlock: ButtonBlock,
  spacerBlock: SpacerBlock,
  dividerBlock: DividerBlock,
  cardBlock: CardBlock,
  eyebrowBlock: EyebrowBlock,
  iconBlock: IconBlock,
  accordionBlock: AccordionBlock,
  row: Row,
  breadcrumbBlock: BreadcrumbBlock,
  tableBlock: TableBlock,
  sliderBlock: SliderBlock,
  tabsBlock: TabsBlock,
  modalBlock: ModalBlock,
  inlineVideoBlock: InlineVideoBlock,
  marqueeBlock: MarqueeBlock,
  contentWrap: ContentWrap,
  blogGridBlock: BlogGridBlock,
}

/** Block types that require client hydration (the 9 'use client' blocks). */
export const HYDRATION_REQUIRED_BLOCK_TYPES = new Set([
  'tabsBlock',
  'sliderBlock',
  'modalBlock',
  'marqueeBlock',
  'tableBlock',
  'inlineVideoBlock',
  'blogGridBlock',
  'eyebrowBlock',
  'breadcrumbBlock',
])

/** Walk section → rows → columns → content (and nested rows/cards/tabs) for hydration need. */
export function sectionNeedsHydration(section: unknown): boolean {
  /* recursive walk over
  any object/array, true if any {_type} ∈ HYDRATION_REQUIRED_BLOCK_TYPES; also true when
  visual editing is on (caller's concern) */
}
```

`ContentBlockRenderer.tsx` is rewritten: delete the `next/dynamic` calls, build the effective registry as `{...defaultBlockRegistry, ...useMastHost().registryOverrides}`, keep the unknown-type fallback div verbatim. The Next adapter restores today's code-splitting by overriding:

```tsx
// frontend/app/lib/mast-adapter.tsx (excerpt)
const SliderBlock = dynamic(() => import('@mast/blocks/blocks/SliderBlock'), {loading: () => <div className="w-full aspect-video bg-muted-background animate-pulse rounded" />})
const TabsBlock  = dynamic(() => import('@mast/blocks/blocks/TabsBlock'),  {loading: () => <div className="w-full h-48 bg-muted-background animate-pulse rounded" />})
const ModalBlock = dynamic(() => import('@mast/blocks/blocks/ModalBlock'), {loading: () => null})
registryOverrides: {sliderBlock: SliderBlock, tabsBlock: TabsBlock, modalBlock: ModalBlock}
```

(Requires per-file subpath exports; see package.json below. Preserve the loading-skeleton markup exactly.)

### 3.5 Sanity helpers with injected config — `src/sanity/`

Move from `frontend/sanity/lib/utils.ts`, converting module-level env reads to parameters:

```ts
// src/sanity/image.ts — urlForImage/getBlurDataUrl/getImageWithBlur become methods of a factory
export function createImageHelpers(config: Pick<MastSanityConfig, 'projectId' | 'dataset'>) {
  const builder = createImageUrlBuilder(config)
  return {urlForImage, getBlurDataUrl, getImageWithBlur} // same bodies as today
}

// src/sanity/dataAttr.ts
export function createDataAttrHelper(config: MastSanityConfig) {
  return (attr: DataAttributeConfig) =>
    createDataAttribute({
      projectId: config.projectId,
      dataset: config.dataset,
      baseUrl: config.studioUrl,
    }).combine(attr)
} // createDataAttribute from '@sanity/visual-editing/create-data-attribute'

// src/sanity/linkResolver.ts — pure, moves verbatim
```

Components access these via a convenience hook `useMastSanity()` in `src/host/context.tsx` that memoizes `createImageHelpers(host.sanity)` and `createDataAttrHelper(host.sanity)`. The `isDraftMode`/`pageId` prop-threading in `PageBuilder`/`Section`/`Column` stays as-is (it already gates `data-sanity` emission); additionally gate on `host.visualEditingEnabled` so a static Astro render can never emit stega attributes.

The Next app keeps thin re-exports in `frontend/sanity/lib/utils.ts` for its remaining consumers (`resolveOpenGraphImage`, `Avatar`, `CoverImage`, `Posts`, `Onboarding`, layout metadata): keep `resolveOpenGraphImage` in the frontend file, implemented over the package's image helpers instantiated with the frontend's env config.

### 3.6 PageBuilder data type — `src/types.ts`

Move `frontend/app/types/blocks.ts` verbatim minus the `@/sanity.types` import (replace `SanityImageAsset` usage with the structural shape it needs). Add:

```ts
export interface MastPage {
  _id: string
  _type: string
  pageBuilder?: Array<{_key: string; _type: string; [k: string]: unknown}> | null
  [k: string]: unknown
}
```

`PageBuilder`'s prop becomes `page: MastPage | null`. `useOptimistic` import moves to `@sanity/visual-editing/react`; `SanityDocument` type from `@sanity/client`.

### 3.7 Package manifest — `packages/mast-blocks/package.json`

```jsonc
{
  "name": "@mast/blocks",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./queries": "./src/queries.ts",
    "./overlays": "./src/overlays/index.ts",
    "./blocks/*": "./src/blocks/*.tsx",
    "./ui/*": "./src/ui/*.tsx",
    "./styles.css": "./src/styles/mast.css",
  },
  "scripts": {"type-check": "tsc --noEmit"},
  "peerDependencies": {"react": "^19", "react-dom": "^19"},
  "dependencies": {
    "@phosphor-icons/react": "^2.1.10",
    "@portabletext/react": "^6.2.0",
    "@radix-ui/react-accordion": "^1.2.12",
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-slot": "^1.2.4",
    "@radix-ui/react-tabs": "^1.1.13",
    "@sanity/asset-utils": "*follow frontend*",
    "@sanity/client": "^7.23.2",
    "@sanity/image-url": "^1.2.0",
    "@sanity/visual-editing": "^5.5.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "groq": "^6.5.0",
    "lucide-react": "^1.24.0",
    "swiper": "^14.0.5",
    "tailwind-merge": "^3.4.0",
  },
}
```

(Adjust the list to what the moved files actually import — run `grep -rhoE "from '[^.@/][^']*'|from '@[^']*'" packages/mast-blocks/src | sort -u` after the move and reconcile. `@sanity/asset-utils` is not currently a direct frontend dep — it resolves transitively today; the package must declare it explicitly.)

**Version-skew note:** `next-sanity@13` bundles `@sanity/visual-editing@^5.5.0`. Pin the package's dep to the same range so npm dedupes to one copy — two copies of visual-editing means two comlink channels and broken overlays. After `npm install`, verify with `npm ls @sanity/visual-editing` (expect a single deduped version).

`packages/mast-blocks/tsconfig.json`: `strict`, `jsx: react-jsx`, `module: preserve`, `moduleResolution: bundler`, `noEmit`, `lib: [dom, dom.iterable, esnext]` — mirror `frontend/tsconfig.json` minus the Next plugin and path alias. **Inside the package, use relative imports only** (no `@/…`), so the source is consumable by any bundler without alias config.

---

## 4. File inventory

### 4.1 Moves into `packages/mast-blocks/src/` (with per-file edits noted)

Legend: [S] = swap `stegaClean` import `next-sanity` → `@sanity/client/stega` (Phase 1). [C] = add `'use client'` + `useMastHost()` usage (Phase 2). Paths on the left are current `frontend/` paths; right is destination under `src/`.

| From `frontend/`                                                                                                                                                                                               | To `src/`                                                         | Edits beyond the move                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/components/PageBuilder.tsx`                                                                                                                                                                               | `PageBuilder.tsx`                                                 | [C] `useOptimistic`→`@sanity/visual-editing/react`; `SanityDocument`→`@sanity/client`; `Link`→host Link; `GetPageQueryResult`→`MastPage`; `studioUrl` from `useMastHost().sanity`; `dataAttr`→`useMastSanity()`                     |
| `app/components/BlockRenderer.tsx`                                                                                                                                                                             | `BlockRenderer.tsx`                                               | none (pure dispatch)                                                                                                                                                                                                                |
| `app/components/PortableText.tsx`                                                                                                                                                                              | `PortableText.tsx`                                                | `PortableText`/types → `@portabletext/react`                                                                                                                                                                                        |
| `app/components/ResolvedLink.tsx`                                                                                                                                                                              | `ResolvedLink.tsx`                                                | [C] `next/link`→host Link; `linkResolver` from package                                                                                                                                                                              |
| `app/components/blocks/index.ts`                                                                                                                                                                               | `blocks/index.ts`                                                 | update relative paths                                                                                                                                                                                                               |
| `app/components/blocks/ContentBlockRenderer.tsx`                                                                                                                                                               | `blocks/ContentBlockRenderer.tsx`                                 | [C] delete `next/dynamic`; registry from context (§3.4)                                                                                                                                                                             |
| `app/components/blocks/Section.tsx`                                                                                                                                                                            | `blocks/Section.tsx`                                              | [S][C] `next/image`→host Image; image helpers + dataAttr via `useMastSanity()`                                                                                                                                                      |
| `app/components/blocks/Row.tsx`                                                                                                                                                                                | `blocks/Row.tsx`                                                  | [S]                                                                                                                                                                                                                                 |
| `app/components/blocks/Column.tsx`                                                                                                                                                                             | `blocks/Column.tsx`                                               | [S][C] dataAttr via hook                                                                                                                                                                                                            |
| `app/components/blocks/HeadingBlock.tsx`                                                                                                                                                                       | `blocks/HeadingBlock.tsx`                                         | [S]                                                                                                                                                                                                                                 |
| `app/components/blocks/RichTextBlock.tsx`                                                                                                                                                                      | `blocks/RichTextBlock.tsx`                                        | [S]; `PortableTextBlock` type → `@portabletext/react`                                                                                                                                                                               |
| `app/components/blocks/ImageBlock.tsx`                                                                                                                                                                         | `blocks/ImageBlock.tsx`                                           | [S][C] host Image; image helpers via hook                                                                                                                                                                                           |
| `app/components/blocks/ButtonBlock.tsx`                                                                                                                                                                        | `blocks/ButtonBlock.tsx`                                          | [S]                                                                                                                                                                                                                                 |
| `app/components/blocks/SpacerBlock.tsx`                                                                                                                                                                        | `blocks/SpacerBlock.tsx`                                          | [S]                                                                                                                                                                                                                                 |
| `app/components/blocks/DividerBlock.tsx`                                                                                                                                                                       | `blocks/DividerBlock.tsx`                                         | [S]                                                                                                                                                                                                                                 |
| `app/components/blocks/CardBlock.tsx`                                                                                                                                                                          | `blocks/CardBlock.tsx`                                            | [S]                                                                                                                                                                                                                                 |
| `app/components/blocks/EyebrowBlock.tsx`                                                                                                                                                                       | `blocks/EyebrowBlock.tsx`                                         | [S] (already client)                                                                                                                                                                                                                |
| `app/components/blocks/IconBlock.tsx`                                                                                                                                                                          | `blocks/IconBlock.tsx`                                            | [S]                                                                                                                                                                                                                                 |
| `app/components/blocks/AccordionBlock.tsx`                                                                                                                                                                     | `blocks/AccordionBlock.tsx`                                       | [S]                                                                                                                                                                                                                                 |
| `app/components/blocks/BreadcrumbBlock.tsx`                                                                                                                                                                    | `blocks/BreadcrumbBlock.tsx`                                      | [S] (client)                                                                                                                                                                                                                        |
| `app/components/blocks/TableBlock.tsx`                                                                                                                                                                         | `blocks/TableBlock.tsx`                                           | [S] (client)                                                                                                                                                                                                                        |
| `app/components/blocks/SliderBlock.tsx`                                                                                                                                                                        | `blocks/SliderBlock.tsx`                                          | [S] (client); `next/image`→host Image                                                                                                                                                                                               |
| `app/components/blocks/TabsBlock.tsx`                                                                                                                                                                          | `blocks/TabsBlock.tsx`                                            | [S] (client)                                                                                                                                                                                                                        |
| `app/components/blocks/ModalBlock.tsx`                                                                                                                                                                         | `blocks/ModalBlock.tsx`                                           | [S] (client); `useSearchParams`→`host.useSearchParam` (§3.3)                                                                                                                                                                        |
| `app/components/blocks/InlineVideoBlock.tsx`                                                                                                                                                                   | `blocks/InlineVideoBlock.tsx`                                     | [S] (client)                                                                                                                                                                                                                        |
| `app/components/blocks/MarqueeBlock.tsx`                                                                                                                                                                       | `blocks/MarqueeBlock.tsx`                                         | [S] (client)                                                                                                                                                                                                                        |
| `app/components/blocks/ContentWrap.tsx`                                                                                                                                                                        | `blocks/ContentWrap.tsx`                                          | [S]                                                                                                                                                                                                                                 |
| `app/components/blocks/BlogGridBlock.tsx`                                                                                                                                                                      | `blocks/BlogGridBlock.tsx`                                        | [S] (client); `next/image`/`next/link`→host; delete module-level `createClient` + env reads → `useMastHost().client` (throw a clear error if absent)                                                                                |
| `app/components/ui/Icon.tsx`, `accordion.tsx`, `breadcrumb.tsx`, `button.tsx`, `card.tsx`, `divider.tsx`, `eyebrow.tsx`, `inline-video.tsx`, `marquee.tsx`, `modal.tsx`, `slider.tsx`, `table.tsx`, `tabs.tsx` | `ui/*`                                                            | `card.tsx`: [C] host Image+Link, image helpers via hook. `inline-video.tsx`: [C] host Image. `breadcrumb.tsx`: [C] host Link. `modal.tsx`: dispatch `mast:locationchange` after history mutations (§3.3). Others: path updates only |
| `app/components/overlays/ContentBlockOverlay.tsx`                                                                                                                                                              | `overlays/ContentBlockOverlay.tsx`                                | `useIsPresentationTool`→`@sanity/visual-editing/react`                                                                                                                                                                              |
| `app/components/overlays/ColumnOverlay.tsx`                                                                                                                                                                    | `overlays/ColumnOverlay.tsx`                                      | same                                                                                                                                                                                                                                |
| `app/components/overlays/OverlayHoverContext.tsx`                                                                                                                                                              | `overlays/OverlayHoverContext.tsx`                                | none                                                                                                                                                                                                                                |
| `app/components/overlays/constants.ts`                                                                                                                                                                         | `overlays/constants.ts`                                           | none                                                                                                                                                                                                                                |
| `app/components/overlays/CustomOverlay.tsx`                                                                                                                                                                    | `overlays/CustomOverlay.tsx`                                      | none (already `@sanity/visual-editing/unstable_overlay-components`)                                                                                                                                                                 |
| `app/components/overlays/ComponentLabelPlugin.tsx`                                                                                                                                                             | `overlays/ComponentLabelPlugin.tsx`                               | none                                                                                                                                                                                                                                |
| `app/components/overlays/BlockContextBridge.tsx`                                                                                                                                                               | `overlays/BlockContextBridge.tsx`                                 | none (plain postMessage — this is the Claude-assistant bridge; both hosts mount it)                                                                                                                                                 |
| `app/lib/parseCustomStyle.ts`                                                                                                                                                                                  | `lib/parseCustomStyle.ts`                                         | none                                                                                                                                                                                                                                |
| `app/lib/resolveContentVariable.ts`                                                                                                                                                                            | `lib/resolveContentVariable.ts`                                   | [S]                                                                                                                                                                                                                                 |
| `app/types/blocks.ts`                                                                                                                                                                                          | `types.ts`                                                        | drop `@/sanity.types` import (D4); add `MastPage`                                                                                                                                                                                   |
| `lib/utils.ts` (the `cn()` helper)                                                                                                                                                                             | `lib/cn.ts`                                                       | none                                                                                                                                                                                                                                |
| `sanity/lib/utils.ts` (partial: `urlForImage`, `getBlurDataUrl`, `getImageWithBlur`, `linkResolver`, `dataAttr`)                                                                                               | `sanity/image.ts`, `sanity/linkResolver.ts`, `sanity/dataAttr.ts` | env → injected config (§3.5); `createDataAttribute`→`@sanity/visual-editing/create-data-attribute`                                                                                                                                  |
| `sanity/lib/queries.ts`                                                                                                                                                                                        | `queries.ts`                                                      | `defineQuery`→`groq`; strings byte-identical                                                                                                                                                                                        |
| CSS extraction from `app/globals.css`                                                                                                                                                                          | `styles/mast.css`                                                 | per D5                                                                                                                                                                                                                              |

New package files: `src/index.ts` (barrel: PageBuilder, BlockRenderer, Section, registry exports, host exports, types), `src/host/types.ts`, `src/host/context.tsx`, `src/host/useWindowSearchParam.ts`, `src/registry.tsx`, `package.json`, `tsconfig.json`.

### 4.2 Stays in `frontend/`, edited

| File                                                                   | Edit                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/layout.tsx`                                                       | wrap children (or just the page content region) in `<MastHostProvider adapter={nextMastAdapter}>`; imports of moved components via `@mast/blocks`                                                                                                                                                               |
| `app/lib/mast-adapter.tsx` (new)                                       | Next adapter: `next/image`, `next/link`, `useSearchParams` wrapper, `dynamic()` registry overrides, sanity config from `sanity/lib/api.ts`, browser client for BlogGrid (reuse env), `visualEditingEnabled` wired from draft mode via a small client provider component that takes it as a prop from the layout |
| `app/page.tsx`, `app/[slug]/page.tsx`                                  | import `PageBuilder` from `@mast/blocks`; keep `GetPageQueryResult` cast                                                                                                                                                                                                                                        |
| `app/posts/[slug]/page.tsx`                                            | `PortableText` import from `@mast/blocks`                                                                                                                                                                                                                                                                       |
| `app/preview/template/[id]/page.tsx`                                   | new client wrapper `app/preview/template/TemplateSectionPreview.tsx` (`'use client'`) that mounts `MastHostProvider` + `Section`, since this page is an RSC importing a now-context-dependent component                                                                                                         |
| `app/design-system/page.tsx`                                           | ui imports → `@mast/blocks/ui/*`; if it renders `Card`/`InlineVideo` (context-dependent), wrap the page content in the provider via a client wrapper                                                                                                                                                            |
| `app/components/Header.tsx`, `Navigation.tsx`, `FooterNew.tsx`         | `ui/button` / `ui/theme-toggle` imports: button from `@mast/blocks/ui/button`; theme-toggle stays local — move the file to `app/components/theme-toggle.tsx` or keep `app/components/ui/theme-toggle.tsx` as the only survivor of `ui/`                                                                         |
| `app/components/overlays/VisualEditingWithPlugins.tsx`                 | imports `customOverlayComponents` and `BlockContextBridge` from `@mast/blocks/overlays`; keeps `next-sanity/visual-editing`                                                                                                                                                                                     |
| `app/components/Posts.tsx`, `Onboarding.tsx`, `PortableText` consumers | update import paths for `linkResolver`/`ResolvedLink` if touched                                                                                                                                                                                                                                                |
| `sanity/lib/utils.ts`                                                  | shrinks to `resolveOpenGraphImage` + re-exports from `@mast/blocks` (instantiating image helpers with frontend env config)                                                                                                                                                                                      |
| `sanity/lib/queries.ts`                                                | `export * from '@mast/blocks/queries'`                                                                                                                                                                                                                                                                          |
| `next.config.ts`                                                       | add `transpilePackages: ['@mast/blocks']`                                                                                                                                                                                                                                                                       |
| `app/globals.css`                                                      | per D5                                                                                                                                                                                                                                                                                                          |
| `tsconfig.json`                                                        | no path-alias change needed (`@/*` keeps working for app files); ensure `include` doesn't need the package (it doesn't — it's a node_modules dep via workspaces)                                                                                                                                                |
| `sanity-typegen.json`                                                  | `path` → array per D4                                                                                                                                                                                                                                                                                           |
| `package.json`                                                         | add `"@mast/blocks": "*"` dependency                                                                                                                                                                                                                                                                            |
| `.env.example`                                                         | unchanged                                                                                                                                                                                                                                                                                                       |

Root `package.json`: `workspaces: ["studio", "frontend", "packages/*", "astro-app"]`; add `dev:astro: "npm run dev --workspace=astro-app"` (picked up by the existing `dev` → `dev:*` glob — decide whether Astro joins the default `npm run dev`; recommendation: yes, it's cheap, but name it `dev:astro` only in Phase 5).

`.github/workflows/ci.yml`: see §7.

---

## 5. Phase plan

Ordering rationale: Phases 1–2 do all the risky _semantic_ changes inside `frontend/` with no file moves, so every step is verifiable against the running, unchanged Next app and each lands as a small reviewable diff. Phase 3 is then a _mechanical_ move of already-decoupled files. The Astro app (5–6) starts only once the package boundary demonstrably holds (Phase 4 gate). This front-loads mechanical low-risk work, keeps upstream-merge pain concentrated in one commit (the move), and never leaves `main`-bound work in a state where the Next app is broken.

### Phase 0 — Reset and baseline (half a session)

1. `git fetch upstream && git checkout main && git reset --hard upstream/main` (confirm `git log -1` shows `22230fe`). Force-push only if David says the remote `main` should move too; otherwise work locally.
2. `git checkout -b feat/mast-blocks-extraction`.
3. `npm install` (fresh lockfile state from upstream), then baseline: `npm run lint`, `npm run typegen --workspace=frontend`, `git diff --exit-code studio/schema.json frontend/sanity.types.ts`, `npm run type-check`, `npm run build --workspace=frontend` (needs `.env.local` with the Sanity vars — copy from the existing working tree before resetting, or from `frontend/.env.example` + David's values).
4. Record baseline results. If `next build` fails on the hardcoded `turbopack.root` (correction #12), fix that one line and note it.

**Verification:** all five commands green. This is the regression bar for every later phase.

### Phase 1 — Mechanical import decoupling, in place (1 session)

No file moves, no behavior change. For every file in §4.1:

- `stegaClean` from `next-sanity` → from `@sanity/client/stega` (23 files: the 22 [S]-tagged blocks/lib files — AccordionBlock, BlogGridBlock, BreadcrumbBlock, ButtonBlock, CardBlock, Column, ContentWrap, DividerBlock, EyebrowBlock, HeadingBlock, IconBlock, ImageBlock, InlineVideoBlock, MarqueeBlock, ModalBlock, RichTextBlock, Row, Section, SliderBlock, SpacerBlock, TableBlock, TabsBlock — plus `app/lib/resolveContentVariable.ts`).
- `app/components/PageBuilder.tsx`: `useOptimistic` → `@sanity/visual-editing/react`; `SanityDocument` → `@sanity/client`.
- `app/components/overlays/ContentBlockOverlay.tsx`, `ColumnOverlay.tsx`: `useIsPresentationTool` → `@sanity/visual-editing/react`.
- `app/components/PortableText.tsx` + `blocks/RichTextBlock.tsx`: `PortableText`/`PortableTextComponents`/`PortableTextBlock` → `@portabletext/react`.
- `sanity/lib/utils.ts`: `createDataAttribute`, `CreateDataAttributeProps` → `@sanity/visual-editing/create-data-attribute`.
- `sanity/lib/queries.ts`: `defineQuery` → `groq`.
- `frontend/package.json`: add `@sanity/visual-editing` (match next-sanity 13's `^5.5.0`), `@portabletext/react` (`^6.2.0`), `groq` (`^6.5.0`), `@sanity/asset-utils`. Then `npm install` and `npm ls @sanity/visual-editing` — must show ONE deduped version. If it shows two, align the semver range with whatever `node_modules/next-sanity/package.json` declares.
- Leave app-side files (`DraftModeToast`, `Onboarding`, `client-utils.ts`, `layout.tsx`, `sanity/lib/client.ts`, `live.ts`, draft-mode route) on `next-sanity` — they stay in the Next app forever.

**Verification:** typegen + staleness diff (queries file changed — regen and inspect: `frontend/sanity.types.ts` should be byte-identical since query strings didn't change; if ordering shifts, commit the regenerated file and confirm CI's diff-after-regen logic still passes), `type-check`, `lint`, `next build`. Manual: `npm run dev`, open Studio at :3334 → Presentation → edit a heading → optimistic update still instant; overlays still label blocks; drag-reorder a section. This proves the re-export equivalence claim at runtime before anything else builds on it.

### Phase 2 — Introduce the adapter seams, in place (1–2 sessions)

Build §3 verbatim, but _inside_ `frontend/` first (e.g. under `frontend/app/mast/host/…`) so the diff is reviewable without simultaneous moves:

1. Add `host/types.ts`, `host/context.tsx`, `host/useWindowSearchParam.ts`, `registry.tsx` (§3.1–3.4).
2. Refactor consumers ([C] rows of §4.1): host `Image` in Section, ImageBlock, SliderBlock, BlogGridBlock, ui/card, ui/inline-video; host `Link` in PageBuilder, ResolvedLink, ui/card, ui/breadcrumb, BlogGridBlock; registry-based `ContentBlockRenderer`; `useSearchParam` in ModalBlock; injected client in BlogGridBlock; config-injected `dataAttr`/image helpers (`useMastSanity`).
3. Write the Next adapter `frontend/app/lib/mast-adapter.tsx` (§4.2) and mount `MastHostProvider` in `layout.tsx`. `visualEditingEnabled` comes from `draftMode()` in the layout, passed as a prop into a small client `MastHostBoundary` component that assembles the adapter (component values like `NextImage` can be referenced directly inside that client module).
4. Fix the two RSC call sites: `preview/template/[id]` client wrapper; audit `design-system/page.tsx`.
5. Keep behavior identical: the Next Image adapter maps `blurDataURL` → `placeholder="blur"` exactly where the current code does; the dynamic-import overrides preserve today's loading skeletons.

**Verification:** `type-check`, `lint`, `next build` (bundle: confirm slider/tabs/modal still split — check `.next` build output lists separate chunks). Manual Presentation checklist (this phase touches everything visual): every block type renders on a seeded page; `?modal=…` opens the modal; blog grid fetches; Section background images with blur; overlays + Claude `claude-block-context` postMessage still fire (open Studio assistant, click a block in preview, confirm the chip updates); template preview route renders.

### Phase 3 — Extract the package (1 session, mostly `git mv`)

1. Create `packages/mast-blocks/` with `package.json` + `tsconfig.json` (§3.7). Root `workspaces` += `packages/*`. `npm install`.
2. `git mv` per §4.1 (use `git mv` for rename detection — it materially helps future upstream merges). Convert all `@/app/...`, `@/lib/utils`, `@/sanity/lib/...` imports inside the package to relative paths.
3. Frontend edits per §4.2: import-path updates, `transpilePackages`, shim files (`sanity/lib/queries.ts`, slimmed `sanity/lib/utils.ts`), delete now-empty dirs.
4. CSS split per D5, including the `@source "../../packages/mast-blocks/src";` line in `globals.css`.
5. Typegen config per D4 (spike first: edit `sanity-typegen.json`, run typegen, confirm the array `path` is accepted and `sanity.types.ts` is unchanged; if array is rejected, fallback = widen the single glob to `"../{frontend,packages/mast-blocks}/..."`-style or keep a re-export file `frontend/sanity/queries-for-typegen.ts` that imports the package queries — pick whichever regenerates identical output).

**Verification:** `npm install` clean; `npm run type-check` (now 3 workspaces); `npm run lint`; typegen + `git diff --exit-code studio/schema.json frontend/sanity.types.ts`; `next build`. **CSS regression check:** build, then grep the emitted CSS in `.next` for a utility only package components use (e.g. `text-eyebrow`, `section-padding`) — if missing, the `@source` path is wrong. Manual: repeat the Phase 2 Presentation checklist. Diff sanity: `git diff --stat` should be dominated by renames.

### Phase 4 — CI, scripts, docs (small; can fold into Phase 3's PR)

- `ci.yml`: no step changes strictly required (see §7), but add `npm run build --workspace=frontend`? **No** — upstream CI deliberately doesn't build (needs env/network); keep parity. Confirm `npm run type-check --workspaces` now covers the package (it will, since the package has the script).
- Root `README`/`CLAUDE.md`: one section describing the package, the adapter, and the corrected CSS filename (`globals.css`), plus the depth-limit tables untouched.
- Gate: Phases 0–4 merged (or at least stacked and green) before starting Astro.

### Phase 5 — Astro workspace, static path (1–2 sessions)

Scaffold `astro-app/` (npm workspace `astro-app`):

- Deps: `astro` (v5.x current), `@astrojs/react`, `@astrojs/sitemap`, `@tailwindcss/vite`, `tailwindcss`, `react`, `react-dom`, `@sanity/client`, `@mast/blocks`. Config `astro.config.mjs`: `integrations: [react(), sitemap()]`, `vite: {plugins: [tailwind()], esbuild: {/* silence 'use client' banner warnings if noisy */}}`, `server: {port: 3002}`. Rendering mode: `output: 'static'` is NOT enough — draft mode needs request-time cookies, so use Astro's default hybrid: static by default, `export const prerender = false` on the draft-aware pages, with the `node` adapter (`@astrojs/node`, standalone). Decision recorded: hybrid + node adapter; a pure-SSG + webhook-rebuild variant is a deployment choice for later, not part of this plan.
- Env: `PUBLIC_SANITY_PROJECT_ID`, `PUBLIC_SANITY_DATASET`, `PUBLIC_SANITY_API_VERSION`, `PUBLIC_SANITY_STUDIO_URL`, `SANITY_API_READ_TOKEN` in `astro-app/.env.example`, read via `import.meta.env`.
- `src/lib/sanity.ts`: two clients (published/CDN; draft with token, `perspective: 'drafts'`, `stega: {enabled: true, studioUrl}`) and
  ```ts
  export async function sanityFetch<T>({query, params = {}, draft = false}): Promise<T>
  ```
  choosing client by the draft flag (from cookie, below).
- `src/lib/mast-adapter.tsx`: `Image` = `<img>` with `loading`, `width/height` or fill-emulation (`position:absolute; inset:0; object-fit:cover` when `fill`), `style.backgroundImage = url(blurDataURL)` + `background-size:cover` as the blur placeholder; `Link` = `<a>`; `useSearchParam` = `useWindowSearchParam` from the package; `client` = published client; sanity config from `import.meta.env`.
- Island entry components (the props-serializability rule: `.astro` may pass only data, never component values, so the provider is assembled _inside_ the island module):
  - `src/components/SectionIsland.tsx` (`'use client'`-agnostic React): `({block, index, sanityConfig}) => <MastHostProvider adapter={buildAstroAdapter(sanityConfig)}><Section block={block} index={index}/></MastHostProvider>`
  - `src/components/PageBuilderStatic.astro`: maps `page.pageBuilder`, and per section renders `<SectionIsland block={section} ... client:visible />` when `sectionNeedsHydration(section)` (from `@mast/blocks`) else the same component with **no** client directive (server-rendered to HTML, zero JS). This is the portability payoff: 15 pure blocks ship no JS.
- Routes: `src/pages/index.astro` and `src/pages/[slug].astro` — `getStaticPaths` from `pagesSlugs` (import from `@mast/blocks/queries`), fetch `getPageQuery`, render `PageBuilderStatic`. `src/pages/posts/[slug].astro` optional/deferred — the goal is the page builder; posts can be a follow-up. Note that skipping posts means `PortableText`, `Avatar`, `CoverImage` parity is not exercised; acceptable.
- Layout `src/layouts/Base.astro`: `@font-face` for General Sans (copy `GeneralSans-Regular.woff2` + `GeneralSans-Medium.woff2` from `frontend/public/fonts/` into `astro-app/public/fonts/`; `font-display: swap`; `<link rel="preload" as="font" crossorigin>` for both; set `--font-general-sans` on `:root` to match the token the theme expects), theme-flash script ported from `layout.tsx` (the localStorage `theme-preference` part only — skip the pinboard iframe block), minimal header/footer (static HTML or ported later; not package scope).
- CSS entry `src/styles/global.css`: `@import 'tailwindcss'; @import '@mast/blocks/styles.css'; @source "../../../packages/mast-blocks/src";` (path relative to the CSS file — verify against where Tailwind resolves `@source`, it's relative to the stylesheet).
- Sitemap: `@astrojs/sitemap` with `site` config; it covers static routes automatically. Parity with the Next `sitemap.ts` (which queries Sanity) is optional — if wanted, a custom `src/pages/sitemap.xml.ts` endpoint using the `sitemapData` query.

**Verification:** `npm run type-check` (add script `astro check` or `tsc --noEmit`; `astro check` needs `@astrojs/check` — add it), `npm run build --workspace=astro-app` (full static build against the real dataset), `npm run dev --workspace=astro-app` and eyeball a seeded page vs. the Next render at :3001 — same DOM structure, same classes. View source on a text-only page: no framework JS for its sections. Tabs/slider/modal work on a page that has them (islands hydrate). `curl -s localhost:3002/<page> | grep -c 'data-sanity'` → 0 (no stega/attrs in static mode).

### Phase 6 — Astro draft mode / Presentation (1 session)

- `src/pages/api/draft-mode/enable.ts` (`prerender = false`): use `validatePreviewUrl` from `@sanity/preview-url-secret` (already a transitive dep of visual-editing; declare it directly) with the token client; on success set an HTTP-only signed cookie (e.g. `mast_draft=1`, `SameSite=None; Secure` — required inside the Studio iframe; on plain-HTTP localhost, `SameSite=Lax` fallback and test Presentation on same-origin localhost) and redirect to the validated URL. Companion `disable.ts` clears it. Studio's `previewMode.enable` path already points at `/api/draft-mode/enable` relative to the preview origin — confirm in `studio/sanity.config.ts` (line ~69) and match the path exactly.
- `[slug].astro` gains: `const draft = Astro.cookies.has('mast_draft')` (with `prerender=false` when draft is possible — practical answer: make `[slug].astro` `prerender = false` under `output: 'server'`-style hybrid OR add a parallel `/preview/[slug].astro` SSR route used as the Presentation origin path; **recommendation: keep one route, `prerender = false`, and rely on CDN caching in prod** — simplest correct thing, and this app is a portability proof, not a production deploy).
- Draft render path: `<LivePageBuilder client:load page={page} sanityConfig={...} />` where `src/components/LivePageBuilder.tsx` composes, inside one island: `MastHostProvider` (adapter with `visualEditingEnabled: true`) → `PageBuilder` from `@mast/blocks` (gets `useOptimistic` reactivity) → `VisualEditing` from `@sanity/visual-editing/react` with `components={customOverlayComponents}` from `@mast/blocks/overlays` → `BlockContextBridge` from `@mast/blocks/overlays`. Data fetched with the draft client (stega on).
- Refresh handling: `VisualEditing`'s default refresh in a non-Next host — pass `refresh={() => location.reload()}` (or finer-grained refetch later); `useOptimistic` covers the common edit loop without reloads.
- Point Studio at it: `SANITY_STUDIO_PREVIEW_URL=http://localhost:3002 npm run dev --workspace=studio` (no Studio code change).

**Verification (all manual — this phase is UI):** In Studio Presentation against :3002 — draft banner cookie set via the enable route (check devtools); edit heading text → optimistic update without reload; block overlays label correctly; click a block → Claude assistant chip updates (`claude-block-context` message); drag-reorder sections; open the same page without the cookie → published content, no stega garbage in copied text. Then re-run the Phase 2 checklist against the Next app at :3001 to confirm nothing regressed there.

---

## 6. Session/commit structure

One PR per phase (or Phases 3+4 combined). Each phase ends with the full command battery green and a commit; never leave a session with `frontend` broken. Suggested branch: single `feat/mast-blocks-extraction` with phase-tagged commits, or stacked branches if review is wanted per phase.

---

## 7. Typegen and CI impact (consolidated)

- `studio/schema.json`: untouched by this work (Studio unchanged). Still extracted by `frontend`'s `typegen` script via `npm --prefix ../studio run extract-types`.
- `frontend/sanity.types.ts`: stays the generated file, stays checked in, stays at the same path. Content should be identical after the queries move (same query names, same strings). Any diff produced by regeneration gets committed in the same PR — the CI staleness check compares regenerated vs. committed, so it passes as long as you commit regenerated output.
- `frontend/sanity-typegen.json`: `path` string → array including `../packages/mast-blocks/src/**/*.{ts,tsx}` (Phase 3, with spike + fallback).
- `frontend/sanity.cli.ts`: unchanged (typegen still runs from `frontend/`).
- `.github/workflows/ci.yml`: **no changes required.** `npm install` handles new workspaces; `npm run type-check` (`--workspaces`) automatically includes `packages/mast-blocks` and `astro-app` once they declare `type-check` scripts (give astro-app `"type-check": "astro check"` and add `@astrojs/check` + `typescript` devDeps); `lint` still targets frontend only (acceptable; optionally add an eslint config to the package later); the staleness diff paths are unchanged by design (D4). The only watch-item: `astro check` downloads nothing but needs the workspace's deps — covered by root `npm install`. If `astro check` proves flaky in CI, downgrade astro-app's `type-check` to `tsc --noEmit`.

---

## 8. Risks and known unknowns (ranked)

1. **Upstream merge cost (structural, permanent).** This fork keeps pulling from `CoreyMoen/mast-sanity`, and upstream will keep editing `frontend/app/components/**` — every upstream change to a moved file becomes a modify/rename conflict against `packages/mast-blocks/src/**`. This is the price of the whole plan; there is no mitigation that preserves the extraction. Reduce it by: using `git mv` (rename detection), keeping moved file _contents_ as close to upstream as possible (Phases 1–2 are surgical), keeping `studio/` and `frontend/` paths otherwise intact (D2), and merging upstream frequently (small conflicts often beat big conflicts rarely). Expect future upstream merges to need a manual pass porting `frontend/app/components` changes into the package. Say this in the PR description so future-David isn't surprised.
2. **Visual-editing dependency duplication.** Two `@sanity/visual-editing` copies (one via next-sanity, one direct) silently breaks overlays/optimistic updates. Mitigation is built into Phase 1: matching semver + `npm ls @sanity/visual-editing` gate after every install.
3. **Tailwind class scanning misses package sources** → styles silently absent. Mitigation: explicit `@source` in both consumers + the Phase 3 built-CSS grep check (`text-eyebrow`, `section-padding` as canaries).
4. **Astro island hydration model vs. the research doc's assumption.** Per-section islands (Phase 5) are the design answer; residual risk is a section whose _nested_ structure defeats `sectionNeedsHydration` (e.g. interactive block inside cardBlock inside tabs). The walker is fully recursive over objects/arrays, which covers arbitrary nesting; test with a seeded kitchen-sink page.
5. **`sanity typegen` array `path` support** (D4). Verify-first spike at the top of Phase 3; two fallbacks documented there.
6. **RSC/context landmines in the Next app** — any server component importing a now-hook-using package component throws at build/runtime. Known sites handled (preview template, design-system); mitigation for unknowns: `'use client'` directives added to all hook-using package files make the failure a loud build error, and Phase 2's `next build` catches it before the move.
7. **`useSearchParams` behavior change in ModalBlock.** Next adapter keeps `next/navigation` so Next behavior is unchanged; the window-based hook is Astro-only. Residual: the `mast:locationchange` event must be dispatched by every URL mutation path in modal code — grep `pushState|replaceState|router\.` in `ModalBlock.tsx`/`ui/modal.tsx` during Phase 2 and cover each.
8. **Presentation inside an iframe needs cookies** (Phase 6): `SameSite` on the draft cookie; localhost is same-site so dev works, but a deployed Astro preview on another origin needs `SameSite=None; Secure`. Handled in Phase 6 design; test both.
9. **`@astrojs/react` + React 19.2.7 compatibility.** Believed fine on current Astro 5.x; verify at Phase 5 start with a hello-world island before porting anything (10-minute spike).
10. **`swiper` / Radix SSR in Astro's server render** of non-hydrated sections: SliderBlock is always hydration-required so it never server-renders without a client runtime — but Astro still SSRs the island's initial HTML; if Swiper touches `window` at import time, the build fails. Spike: build one page containing a slider early in Phase 5. Fallback: `client:only="react"` for slider-bearing sections.
11. **Docker drift** (declared non-goal, but a known consequence): frontend Docker builds will break on `@mast/blocks` resolution until refreshed. Recorded in the PR description; no action.

---

## 9. Quick reference — commands

```sh
# baseline / per-phase battery
npm install
npm run lint
npm run typegen --workspace=frontend
git diff --exit-code studio/schema.json frontend/sanity.types.ts
npm run type-check
npm run build --workspace=frontend

# dep-dedup gate (Phases 1, 3, 5)
npm ls @sanity/visual-editing

# dev, for manual Presentation checks
npm run dev                       # frontend :3001 + studio :3334
npm run dev --workspace=astro-app # :3002 (Phase 5+)
SANITY_STUDIO_PREVIEW_URL=http://localhost:3002 npm run dev --workspace=studio  # Phase 6
```

Manual Presentation checklist (Phases 1, 2, 3, 6): open Studio → Presentation → seeded kitchen-sink page: (a) all 20 block types render; (b) heading edit shows instantly (optimistic); (c) section drag-reorder preserves content; (d) overlays label blocks and columns; (e) clicking a block updates the Claude assistant context chip; (f) `?modal=<id>` opens the modal; (g) blog grid populates; (h) template preview route (`/preview/template/<id>`) renders; (i) buttons without links show the magenta dashed outline. There is no automated test suite in this repo — this checklist plus type-check/lint/build is the regression net; do not skip it on the phases marked manual.
