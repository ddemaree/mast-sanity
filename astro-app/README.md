# Mast Astro consumer

Proof that `@mast/blocks` is framework-portable. Renders the same Sanity page builder as the Next.js frontend via a host adapter.

## Setup

1. Copy `.env.example` to `.env` and fill in Sanity credentials (`PUBLIC_*` mirrors the Next `NEXT_PUBLIC_*` values; `SANITY_API_READ_TOKEN` is needed for draft/Presentation).
2. From the repo root: `npm install && npm run dev:astro` (port **3002**).
3. Point Studio Presentation at Astro: `SANITY_STUDIO_PREVIEW_URL=http://localhost:3002 npm run dev:studio`.

## Architecture

- Static sections render to HTML with no client JS when they only contain pure blocks.
- Interactive blocks (tabs, slider, modal, etc.) hydrate per-section via `client:visible`.
- Draft mode uses `/api/draft-mode/enable` (same path Studio expects) and a `mast_draft` cookie.
