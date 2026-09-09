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

### Playback position model (`lib/playback/`)
`clock.ts` holds the virtual playback clock: it compensates for the staleness of a polled progress sample, re-anchors hard on a seek or track change, and absorbs small divergence as capped per-poll drift. `hooks/usePlaybackClock.ts` owns two anchors from it: true playback (read by the chord strip and the line highlight) and speed-adjusted (read by `AutoScroller`), because the auto-scroll speed control is a statement about the scroll, not the music.

`sheet-map.ts` is pure arithmetic over line geometry: it groups rendered lines into weighted *units* (a positional chord line pairs with the lyric line beneath it), maps song fraction to scrollTop and back, and flattens chords into ordered cues. `sheet-lines.ts` is the DOM reader that feeds it. The split exists because Vitest runs in `node` with no layout, so anything reading `offsetTop` cannot be unit-tested; geometry is covered by Playwright instead.

`hooks/useSheetMap.ts` is the sole owner of map rebuilds: both observers, the paint-retry ladder and the debounce live there once, and `AutoScroller`, `ChordStrip` and `useCurrentLine` all read one instance. Don't add observers to those consumers; they are renderers of a map they are handed. The MutationObserver is scoped to the sheet element rather than the scroll container because chord diagrams replace their own children asynchronously.

There is no beat grid. Spotify's `audio-analysis` endpoint returns 403 for apps registered after 2024-11-27, so chord timing is estimated from sheet position and nothing else. Don't add tempo or beat detection.

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
- Sheet line positions are measured as `rect.top - (containerRect.top - container.scrollTop)`, never `offsetTop`. Nothing between a sheet line and `<body>` is positioned, so `offsetTop` is measured from `<body>` and includes the whole header stack, which scrolls every sheet ahead of the music by that height. There is no unit test that can catch this (Vitest has no layout).
- Clock anchor transitions live in the pure `nextClockState` reducer, not in an effect. Pause and resume are discontinuities: drift moves an anchor's `progressMs` without moving its `at`, so a stored `progressMs` sits far behind the true position by mid-song, and reading it while paused snapped the strip back to the first chord. Add new transitions to the reducer, with a test.
- Capo spellings live in `tests/lib/chordpro/capo-formats.test.ts`; add a case there before touching the regex. Two rules parse prose: (a) a line that is *only* a capo phrase (with surrounding `()[]` and trailing punctuation allowed), which rejects lyrics by requiring the entire line to be the phrase, not just containing it; (b) a metadata line opening with `Label:` and containing capo after a `,`, `;`, or `|` separator. Prose is only read from the first 25 non-blank lines. UG also reports a capo as tab metadata, emitted as a `{capo:}` directive when prose doesn't state one.
- Provenance is a `{source: url}` directive injected once in `findChords`, so every provider gets it. It must NOT be a prose "Source:" line: `stripMetaPreamble` keeps directives but strips that label, and strips bare URLs as credit lines, so prose vanishes at render time.
- Diagram containers carry `data-chord-diagram`; sheet chord tokens carry `data-chord`. They are different attributes on purpose: one selector matching both resolved clicks to the CSS-hidden mobile palette on desktop.
- New `Prefs` fields must be added to `lib/prefs/merge.ts` as well as `lib/prefs/defaults.ts`. The PUT handler merges through an explicit field list, which silently dropped `autoScrollSpeed` and `fontScale` for several releases.
- A chord diagram sets its own size with an inline `style` (`components/ChordDiagram.tsx`), so a stylesheet `max-height` cannot constrain it — CSS resolves `min-height` over `max-height`. That is why the strip's band height is a breakpoint-dependent `--chord-strip-h` token sized to fit the diagram, rather than the diagram being scaled down.
- `tests/e2e/global-setup.ts` runs AFTER the `webServer` health poll in Playwright 1.59.1, contradicting its own comment. It bites a clean checkout with no `.e2e-data/` directory. Pre-existing, deliberately not fixed, worth knowing before someone debugs it from scratch.

## Deployment

Docker image built by `.forgejo/workflows/build.yml` on tag `v*` / `main` push, pushed to `forgejo.dougall.ca` (and GHCR public mirror per release). Runs on a homelab rpi5 (Ansible role `homelab-infra/ansible/roles/chords/`, Traefik route `chords.dougall.ca`, LAN-only). `better-sqlite3` and rollup are native/platform-specific — a `node_modules` from one OS/arch won't run on another; reinstall after moving machines.

## Project state

`STATE.md` tracks current status, shipped versions, external-provider health, and known gaps. Read it before starting work — it's the handoff between sessions. The spec lives at `docs/superpowers/specs/2026-04-16-chordplay-design.md`.
