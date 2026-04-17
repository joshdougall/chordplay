# Chordplay — Design Spec

**Date:** 2026-04-16
**Status:** Draft, pending approval
**Working repo name:** `chordplay` (tentative, easy to rename before implementation)

## Summary

A single-user web app, deployed to the homelab, that shows chord sheets or guitar tabs for whatever Spotify is currently playing, with optional playback-synced auto-scroll. Your chord/tab library lives on disk as files (ChordPro, Guitar Pro, ASCII tabs); edits made through the UI write back to those files so the library is trivially version-controllable later.

## Goals

- Open the app, start Spotify on any device, and see the right sheet appear within a couple of seconds.
- Toggle chord view vs tab view per song when both exist.
- Toggle auto-scroll that stays roughly synced to track progress.
- Edit sheets through the UI; edits land back in the filesystem.
- Deploy and operate the app the same way every other homelab service is deployed (Ansible role, Docker container, Traefik).

## Non-goals (v1, captured as expansion hooks)

- Search, playback control (play/pause/skip), library browse page
- Multi-user support, Authentik SSO
- External chord/tab sources (Ultimate Guitar scraping, Songsterr API)
- Section-timed auto-scroll (only pace-based in v1)
- Transpose, capo support, setlist mode
- Mobile app (responsive web is sufficient)
- Git sync of library dir (planned, but manual git for v1)

## Stack

- **Framework:** Next.js 15 App Router, TypeScript, Tailwind
- **Runtime:** Node 22, Docker
- **Storage:** filesystem only. No database. Library files on bind-mounted `/library`; runtime state (encrypted tokens, user prefs) in JSON files on bind-mounted `/data`.
- **Rendering libraries:**
  - [`chordsheetjs`](https://github.com/martijnversluis/ChordSheetJS) for ChordPro
  - [`alphaTab`](https://alphatab.net) for Guitar Pro files
  - monospace `<pre>` for ASCII tabs
- **File watcher:** `chokidar`
- **OAuth:** Spotify Authorization Code + PKCE, standard flow
- **Test runner:** `vitest`

## Deployment

- Ansible role `chords` under `homelab-infra/ansible/roles/chords/`, following the pattern used by existing roles such as `actual` and `mealie`.
- Docker image published to homelab registry (or built locally and pushed, matching existing practice).
- Traefik route `chords.dougall.ca`, local DNS only, no Cloudflare tunnel.
- TLS via the existing DNS-01 Let's Encrypt wildcard for `*.dougall.ca`.
- Secrets in Ansible vault: `APP_SECRET` (token encryption key), `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`.
- Bind mounts:
  - `{{ chords_library_path }}:/library:rw`
  - `{{ chords_data_path }}:/data:rw`
- Healthcheck: `GET /api/health` returns 200 when the library index is ready and `/data` is readable (not-logged-in is still "healthy"; Spotify connection is not required for the app to be up).
- Target host: determined during planning (reuse an existing host already running Next.js-style workloads).

## Architecture

All runtime logic lives inside one Next.js container.

### Volumes

- `/library` — root of the chord/tab library. Recursive, supports nested folders. Eventual home for a separate git repo.
- `/data` — runtime state:
  - `tokens.json` — encrypted Spotify refresh token, issued-at, scopes. AES-GCM, key derived from `APP_SECRET`.
  - `prefs.json` — per-song format preference (chords|tab), global auto-scroll default, track-id → library-file override map.

### Components

1. **`SpotifyAuth`** (server module)
   - Endpoints: `GET /api/auth/login`, `GET /api/auth/callback`, `POST /api/auth/logout`
   - OAuth Authorization Code + PKCE
   - Encrypts refresh token (AES-GCM, key from `APP_SECRET`) → `/data/tokens.json`
   - Exposes `getAccessToken()` for other modules, refreshes lazily when expired

2. **`NowPlaying`** (server module)
   - `GET /api/now-playing` returns `{ track_id, title, artists, album_art, progress_ms, duration_ms, is_playing }`
   - Caches upstream Spotify response for 1s to absorb client poll bursts
   - On 401 from Spotify: refresh access token, retry once, surface error if still failing
   - On 429: respect `Retry-After`, client handles backoff

3. **`Library`** (server singleton)
   - On boot, walks `/library` recursively, parses every `.pro`, `.cho`, `.txt`, `.gp`, `.gpx`, `.gp5` file
   - Extracts `{title, artist}` from ChordPro directives (`{title: ...}`, `{artist: ...}`); falls back to filename convention `Artist - Title.ext`
   - Reads optional `{spotify_track_id: ...}` directive for exact matching
   - Builds in-memory `Map<libraryId, Entry>` plus two secondary indexes:
     - `by-spotify-track-id: Map<string, libraryId>`
     - `by-normalized-key: Map<string, libraryId[]>` (normalized `${artist}|${title}`, lowercase, stripped punctuation)
   - `chokidar` watches for file add/change/remove and keeps indexes live

4. **`LibraryMatcher`** (server module)
   - `match(trackId, title, artists) -> { entry, confidence: 'exact' | 'fuzzy' } | { match: null }`
   - Order:
     1. Exact on `spotify_track_id` → confidence `exact`
     2. Exact on normalized `${artist}|${title}` → confidence `exact`
     3. Best fuzzy on normalized key (Levenshtein ratio), threshold 0.85 → confidence `fuzzy`
     4. Else null
   - Prefs `track-id → library-file override map` takes absolute priority over all of the above

5. **`LibraryEditor`** (server module)
   - `GET /api/library/:id` returns raw file contents
   - `PUT /api/library/:id` writes file atomically (`write to tmp + rename`)
   - `POST /api/library` creates a new file given `{title, artist, format, content, spotify_track_id?}`; generates safe filename
   - All paths sanitized against traversal; rejects anything escaping `/library`
   - Concurrent edits: last-writer-wins (acceptable for single user)

6. **Renderer** (client-side React components)
   - `<ChordProView sheet={...} />` — wraps ChordSheetJS, outputs styled HTML
   - `<TabView kind="alphatab" | "ascii" data={...} />` — alphaTab for Guitar Pro, monospace `<pre>` for ASCII
   - `<AutoScroller enabled progressMs durationMs contentRef />` — client-side smooth scroll, offset = `(progressMs / durationMs) × (contentHeight − viewportHeight)`; requestAnimationFrame driven
   - Auto-scroll has a small speed nudge control (+/−) that multiplies the computed rate; does not change the underlying math, just lets you correct drift mid-song

7. **Main page (`/`)** — single client component
   - If not authenticated, shows "Connect Spotify" button
   - Polls `/api/now-playing` every 2s (tab-visibility aware: pauses when tab hidden)
   - On track change, fetches `/api/library/match` and sets the active entry
   - Renders the appropriate view based on entry format and user's chord/tab preference
   - Shows quick-add form when match is null
   - Edit button opens inline editor

### Component boundaries

- Renderer does not know about Spotify.
- Library does not know about rendering.
- Auth is its own module with a single `getAccessToken()` public surface.
- Matching is a pure function over `(track, library state, prefs)`.

## Data flow

### One-time auth

1. User visits `/`, not authenticated
2. Clicks "Connect Spotify" → `GET /api/auth/login`
3. Server generates PKCE verifier + state, stores in short-lived cookie, redirects to Spotify
4. Spotify redirects to `GET /api/auth/callback?code=...&state=...`
5. Server validates state, exchanges code for access + refresh tokens
6. Encrypts refresh token, writes `/data/tokens.json`
7. Redirects to `/`

### Steady-state poll

1. Client polls `GET /api/now-playing` every 2s (paused when document hidden)
2. Server returns cached response if <1s old
3. Otherwise calls Spotify `/me/player/currently-playing`
4. On 401: refresh token, retry once
5. Client compares `track_id` against last known; on change, calls `GET /api/library/match?track_id=X&title=Y&artist=Z`
6. Renders the match (or quick-add form)
7. If user toggles auto-scroll, client begins rAF loop computing scroll offset from `progress_ms / duration_ms`

### Library edit

1. User clicks "Edit" on current sheet
2. Client `GET /api/library/:id` → raw contents
3. User edits in textarea (ChordPro/ASCII) or uploads a new Guitar Pro file
4. Save → `PUT /api/library/:id`
5. Server writes atomically, chokidar fires, index updates
6. Client re-fetches current match and re-renders

### Quick-add (track has no match)

1. User sees "No sheet for this track — add one?"
2. Fills in title (pre-filled from Spotify metadata), artist (pre-filled), format (chords | tab-ascii | tab-gp), content
3. Server writes a new file under `/library/new/` (or a user-chosen subfolder) with templated filename, including `{spotify_track_id}` directive so future exact matches work
4. Index updates, view switches to the new sheet

## Error handling

| Condition | Behavior |
|---|---|
| Spotify API 401 | Refresh access token once, retry. If still 401, surface "reconnect Spotify" banner linking to `/api/auth/login`. |
| Spotify API 429 | Server respects `Retry-After`. Client backs off exponentially (2s → 4s → 8s, cap 30s) and shows a "Spotify rate-limited" banner. |
| Spotify API 5xx / network error | Show last cached track, "Spotify unreachable, retrying" banner, same exponential backoff. |
| Nothing currently playing | Idle state, show last played track if known, "waiting for playback" hint. |
| Token refresh fails permanently | Surface reconnect banner. No silent retry loop. |
| Library file parse error | Entry still indexed with `parse_error: true`, rendered as raw text with a warning, logged to stdout. |
| Path traversal on edit | Reject with 400, log attempt. |
| Disk write failure | Client receives 500 with message. Atomic rename means no partial writes. |
| Unknown ChordPro directive | ChordSheetJS handles; we don't add validation. |
| `APP_SECRET` missing at boot | Container fails to start with clear log. |
| `/library` unreadable at boot | Container fails to start with clear log. |
| `/data` unreadable at boot | Container fails to start with clear log. |

## Testing

- **Unit:**
  - Library parser: ChordPro directives, filename fallback, Guitar Pro binary detection
  - LibraryMatcher: exact track-id, exact normalized key, fuzzy threshold, prefs override
  - Token encrypt/decrypt round-trip
  - Path sanitization (traversal rejection)
- **Integration:**
  - Library watcher: add/change/remove a fixture file, index reflects within ~100ms
  - Auth callback: mocked Spotify exchange, `/data/tokens.json` written and decryptable
  - `/api/now-playing` caching: two calls within 1s hit cache, third call after 1s refreshes
  - `PUT /api/library/:id` atomic write: crash mid-write (fault-injected) doesn't corrupt file
- **Manual / smoke:**
  - Real Spotify OAuth round-trip against deployed staging URL
  - Play a known in-library song, verify sheet appears and auto-scroll drift is acceptable
  - Add a sheet via quick-add and verify it matches on next play
- **No full E2E framework** in v1. `vitest` only.

## Configuration

Environment variables (set via Ansible vault / `docker-compose`):

| Variable | Purpose |
|---|---|
| `APP_SECRET` | 32-byte base64 key for AES-GCM token encryption |
| `SPOTIFY_CLIENT_ID` | Spotify app client ID |
| `SPOTIFY_CLIENT_SECRET` | Spotify app client secret |
| `SPOTIFY_REDIRECT_URI` | `https://chords.dougall.ca/api/auth/callback` |
| `LIBRARY_PATH` | Default `/library` inside container |
| `DATA_PATH` | Default `/data` inside container |
| `LOG_LEVEL` | `info` default |

## File formats supported

- **ChordPro** (`.pro`, `.cho`) — primary format for chords, written natively by ChordSheetJS
- **Plain text** (`.txt`) — treated as ASCII tab or plain chord sheet; heuristic: contains `|--` or `e|` lines → tab
- **Guitar Pro** (`.gp`, `.gpx`, `.gp5`) — rendered by alphaTab

## Filename convention

Preferred: `Artist/Song Title.pro` (nested by artist). Fallback for flat layouts: `Artist - Song Title.pro`. Library parser handles both. Case-insensitive matching on fuzzy path.

## Security notes

- Refresh token encrypted at rest. Access token is in memory only.
- No user-provided HTML rendering: ChordSheetJS output is trusted (library author is you). ASCII/tab rendered inside `<pre>`.
- CSRF not a concern for single-user: all mutating endpoints are gated by a server-side auth check; no cookies cross origins.
- `APP_SECRET` must be persistent across restarts or existing tokens become undecryptable (forces re-auth, not data loss).

## Expansion hooks (out of v1, noted so v1 doesn't paint us into a corner)

- **Search (`GET /api/search?q=`)** — Spotify search passthrough, returns tracks with match info
- **Playback control (`PUT /api/player/...`)** — play/pause/skip, new permissions scope
- **Library browser (`/library`)** — list all entries, filter, pick one, optionally "play this on Spotify"
- **Transpose / capo** — handled client-side; ChordSheetJS already supports transposition
- **Section-timed auto-scroll** — `{section: intro, time: 0.0}` ChordPro directives, `<AutoScroller>` switches to section mode when present
- **Multi-user** — move tokens from single `tokens.json` to `tokens/{userId}.json`; add Authentik SSO at Traefik level
- **External fallback** — matcher falls through to a provider plugin (Ultimate Guitar, Songsterr) when library miss; result offered as quick-add prefill
- **Git sync** — library dir becomes a git repo; server runs `git pull` on a timer, commits + pushes on user edits
- **Setlist mode** — ordered queue of library entries for live use
- **Mobile PWA** — add manifest + service worker once v1 is stable

## Open items for implementation planning

- Exact Ansible host target (will check inventory when writing the plan)
- Whether to publish Docker image to a registry or build on target (match existing homelab practice)
- Whether `chordplay` is the final name or a rename is wanted before the repo goes to Forgejo
