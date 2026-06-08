# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Chordplay shows chord sheets and guitar tabs for the user's currently-playing Spotify track, with playback-synced auto-scroll. Sheets come from the user's own file library or are fetched on demand from external scrapers. Next.js 15 (App Router) + React 19 + TypeScript, deployed as a single Docker container (self-hosted, personal use). Multi-user: each user connects their own Spotify account; the file library is shared.

## Commands

```bash
npm run dev          # dev server on :3000
npm run build        # production build
npm test             # unit/integration (Vitest, node env)
npm run test:watch
npm run test:e2e     # Playwright (spins up its own dev server on :3000 with test env)
npm run test:e2e:ui
npm run lint         # next lint (eslint flat-config warning is harmless/pre-existing)
npx tsc              # type check (no emit beyond tsbuildinfo)
```

Run a single unit test: `npx vitest run tests/lib/config.test.ts` (or `-t "name"`).
Run a single e2e spec: `npx playwright test tests/e2e/05-transpose.spec.ts`.

Unit tests live in `tests/` (mirroring `lib/`), not colocated. They run in `node` environment with the `@` alias resolving to repo root. E2E tests run serially (`workers: 1`, `fullyParallel: false`) against `.e2e-data/` with a zero-filled APP_SECRET and `NODE_ENV=test`.

## Environment / config

All config flows through `lib/config.ts` (`getConfig()`, cached). `APP_SECRET` must base64-decode to exactly 32 bytes (it's the AES key for token/session encryption). Required: `APP_SECRET`, `SPOTIFY_CLIENT_ID/SECRET/REDIRECT_URI`, `LIBRARY_PATH`, `DATA_PATH`. Optional: `LOG_LEVEL`, `CHORDPLAY_ADMIN_USERS` (comma-separated user IDs for `/settings/admin`), `FORGEJO_*` (issue reporting). Copy `.env.example` → `.env.local`.

## Architecture

### Data flow (the core loop)
`app/page.tsx` is the client-side heart. It polls `/api/now-playing` via `useNowPlaying`, then on track change calls `/api/library/match` to find a sheet, then `/api/library/[id]` for content. When Spotify is idle it falls back to `/api/spotify/recently-played`. All user state (transpose, version choice, split-view, auto-scroll, fuzzy-match overrides) is persisted through `/api/prefs`.

### Two sources of chord sheets
1. **Local library** (`lib/library/`): an in-memory `LibraryIndex` (`index.ts`) built by walking `LIBRARY_PATH`. Held as a process singleton (`singleton.ts`) with a `chokidar` watcher (`watcher.ts`) keeping it live. Each file is indexed three ways: by id (relative path), by `spotifyTrackId` directive, and by a normalized `artist|title` key. `matcher.ts` resolves a playing track to an entry: pref override → exact track-id → exact normalized-key → weighted Levenshtein fuzzy match (title weighted higher than artist, floors + threshold in the file). Multiple files sharing a key become selectable "versions."
2. **External scrapers** (`lib/external/`): `chords.ts` holds an ordered `PROVIDERS` registry, tried in sequence with per-provider disk (or in-memory under test) caching including negative caching. Most providers are HTML scrapers keyed to specific page markup and break silently on redesigns. **`ultimate-guitar-api` is the primary and a single point of failure for catalog coverage** — see STATE.md for current provider health. Disabled providers are commented out (not deleted) with `void` references to keep imports lint-clean.

### Formats
`lib/library/format.ts` detects `chordpro` | `ascii-tab` | `guitar-pro`. ChordPro renders via `chordsheetjs` + custom chord diagrams (`svguitar` / `@tombatossals/chords-db`); ASCII tabs render monospace; Guitar Pro files render via `@coderline/alphatab` and are served raw through `/api/library/raw/[id]`. Split view shows a chordpro pane + a tab pane side by side when both exist for one song.

### Auth (`lib/auth/`)
Spotify OAuth with PKCE (`pkce.ts`). Session is an encrypted httpOnly cookie (`session.ts`, `cp_session`). Per-user Spotify refresh tokens are AES-encrypted at rest under `DATA_PATH/users/<userId>/tokens.json` (`tokens.ts` + `crypto.ts`); access tokens are cached in-memory and refreshed with a margin (`spotify.ts`). `migrate.ts` runs once per boot to lift legacy single-user files into the per-user layout. `userId` is always validated against `/^[A-Za-z0-9._-]+$/` before being used in a path.

### Per-user data under DATA_PATH/users/<userId>/
`tokens.json` (encrypted refresh token), `prefs.json` (`lib/prefs/store.ts` — transpose, overrides, preferred versions, split-view), and user chord-diagram overrides. Usage events go to a shared `usage.db` (`lib/usage/db.ts`, better-sqlite3 WAL, event-sourced) surfaced at `/settings/admin`.

### API routes (`app/api/`)
All under `/api/*`; `middleware.ts` stamps an `x-request-id` on each. Route handlers read `getSession()` and return 401 when absent. Spotify proxying lives under `/api/spotify/*` (now-playing is cached ~1s per user in `now-playing-cache.ts` to survive the 2s client poll). Library mutations (`/api/library/[id]`, `/duplicate`, `/spotify-track`, `/import`) go through `lib/library/editor.ts`, which enforces path-traversal safety via `safePath()`.

## Conventions

- Path alias `@/` = repo root (set in both `tsconfig.json` and `vitest.config.ts`).
- Structured logging only: server `lib/logger.ts` (pino), client `lib/client-logger.ts`. No `console.*` in app code (migrate.ts is the deliberate exception).
- File writes are atomic: write to `*.tmp.<pid>` then `rename`. Follow this for any new persisted file.
- Secret-touching errors are swallowed deliberately (auth degrades to "re-login"); don't "fix" these into throws without understanding the UX intent.
- ESLint-disabled `exhaustive-deps` in `app/page.tsx` effects is intentional — the match/content effects key off `trackId` deliberately, not every dependency.
- UI uses CSS custom properties (`var(--bg)`, `var(--ink-muted)`, `var(--accent)`, etc.) defined in `globals.css`, plus Tailwind utilities. Match this when adding UI.

## Deployment

Docker image built by `.forgejo/workflows/build.yml` on tag `v*` / `main` push, pushed to `forgejo.dougall.ca` (and GHCR public mirror per release). Runs on a homelab rpi5 (Ansible role `homelab-infra/ansible/roles/chords/`, Traefik route `chords.dougall.ca`, LAN-only). `better-sqlite3` and rollup are native/platform-specific — a `node_modules` from one OS/arch won't run on another; reinstall after moving machines.

## Project state

`STATE.md` tracks current status, shipped versions, external-provider health, and known gaps. Read it before starting work — it's the handoff between sessions. The spec lives at `docs/superpowers/specs/2026-04-16-chordplay-design.md`.
