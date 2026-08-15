# AGENTS.md

Project-wide guidance for coding agents. See `CLAUDE.md` for the deep content-architecture reference (page-builder hierarchy, Sanity nesting-depth limits, block types) and `README.md`/`CONTRIBUTING.md` for the canonical setup and command docs.

## Cursor Cloud specific instructions

This is an npm-workspaces monorepo (`mast-sanity`) with two workspaces:

- `frontend/` — Next.js 16 app (App Router, Turbopack), dev server on port **3001**.
- `studio/` — Sanity Studio v6 (schemas + Presentation/Visual Editing), dev server on port **3334**.

There is **no local datastore**: both apps talk to Sanity's hosted Content Lake, so a real Sanity project/dataset plus tokens are required (see below).

### Standard commands

Commands are already documented in `README.md` / `CONTRIBUTING.md`; the important ones:

- Run everything: `npm run dev` (frontend 3001 + studio 3334 in parallel).
- Run one: `npm run dev:next` / `npm run dev:studio`.
- CI checks (match `.github/workflows/ci.yml`): `npm run lint`, then `npm run typegen --workspace=frontend` (fails CI if `studio/schema.json` or `frontend/sanity.types.ts` are stale — commit regenerated files), then `npm run type-check`.

### Environment variables (non-obvious mapping)

The frontend reads `NEXT_PUBLIC_SANITY_PROJECT_ID` / `NEXT_PUBLIC_SANITY_DATASET` (and `SANITY_API_READ_TOKEN`), but the injected Cloud secrets use the `SANITY_STUDIO_*` names. The startup/update script bridges this by generating gitignored env files (`frontend/.env.local`, `studio/.env`) from the injected `SANITY_STUDIO_PROJECT_ID`, `SANITY_STUDIO_DATASET`, and `SANITY_API_READ_TOKEN`. The Studio itself reads `SANITY_STUDIO_*` directly from the process env, so it works without a file. If the frontend errors with `Missing environment variable: NEXT_PUBLIC_SANITY_*`, recreate `frontend/.env.local` from those injected secrets.

### Startup gotchas

- **Studio prompts on start.** `sanity dev` may print `Do you want to upgrade local versions? (Y/n)` (local `sanity` 6.5.0 vs auto-update runtime 6.9.2). Answer **`n`** (do not upgrade) — startup then continues. In a non-interactive terminal this blocks until answered, so send `n`.
- **Turbopack root.** `frontend/next.config.ts` sets `turbopack.root` to the monorepo root, resolved dynamically from the config file's location. Do not replace it with a hardcoded absolute path — that breaks `next dev` on every machine except the one hardcoded.

### Content, auth, and known limits

- The injected `SANITY_API_READ_TOKEN` is **read-only**. Creating/publishing/seeding content is not possible with it (`npm run seed` and any write needs a Sanity token with Editor/write permissions in `SANITY_API_TOKEN`).
- The Sanity Studio at `:3334` requires interactive Sanity login (Google/GitHub/email); a fresh Cloud VM browser session is not logged in.
- The dataset may have empty pages — the frontend then renders an "Add content to this page" empty state, which still confirms the app is querying Sanity successfully.
- **CORS for Visual Editing/Live:** the frontend origin (e.g. `http://localhost:3001`) must be added to the Sanity project's CORS allowlist at sanity.io/manage for Sanity Live / Presentation to connect; without it the app still renders but shows a "Sanity Live couldn't connect" notice.
