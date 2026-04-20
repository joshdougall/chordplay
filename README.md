# Chordplay

Shows chord sheets and guitar tabs for whatever is currently playing on Spotify, with playback-synced auto-scroll. Chord sheets are fetched automatically from Ultimate Guitar, Chordie, and other sources, or you can add your own files.

## Features

- Auto-fetches chord sheets when a song starts playing
- ChordPro, ASCII tab, and Guitar Pro file support
- Chord diagrams with correct voicings (including slash chord inversions like D/C, G/B)
- Transpose + capo suggestions
- Per-user library with multi-version support
- Spotify playlist browser with batch chord import
- Auto-scroll with speed control
- Multi-user (each user authenticates with their own Spotify account)

## Prerequisites

- Node.js 22+
- A [Spotify Developer app](https://developer.spotify.com/dashboard) in Development Mode

> **Spotify user limit:** Development Mode allows up to 25 users. Each user's Spotify email must be added to your app's allowlist in the Spotify Developer Dashboard before they can log in.

## Local development

```bash
git clone <repo-url>
cd chordplay
npm install
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
APP_SECRET=<32-byte base64 string>

SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:3000/api/auth/callback

# Created automatically on first run
LIBRARY_PATH=./data/library
DATA_PATH=./data/app
```

```bash
npm run dev
# open http://localhost:3000
```

## Required environment variables

| Variable | Purpose |
|---|---|
| `APP_SECRET` | 32 bytes of randomness, base64-encoded. `openssl rand -base64 32` |
| `SPOTIFY_CLIENT_ID` | From your Spotify Developer Dashboard |
| `SPOTIFY_CLIENT_SECRET` | From your Spotify Developer Dashboard |
| `SPOTIFY_REDIRECT_URI` | Must exactly match what's registered in your Spotify app |
| `LIBRARY_PATH` | Directory where chord/tab files are stored |
| `DATA_PATH` | Directory for user tokens, prefs, and cache |

### Optional

| Variable | Default | Description |
|---|---|---|
| `LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error` |
| `CHORDPLAY_ADMIN_USERS` | _(none)_ | Comma-separated Spotify user IDs with access to `/settings/admin` |

## Docker

```yaml
# docker-compose.yml
services:
  chords:
    build: .
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      APP_SECRET: <32-byte base64 string>
      SPOTIFY_CLIENT_ID: your_client_id
      SPOTIFY_CLIENT_SECRET: your_client_secret
      SPOTIFY_REDIRECT_URI: https://chords.yourdomain.com/api/auth/callback
      LIBRARY_PATH: /data/library
      DATA_PATH: /data/app
      HOSTNAME: "0.0.0.0"   # required — Next.js standalone binds to $HOSTNAME otherwise
    volumes:
      - ./library:/data/library
      - ./appdata:/data/app
```

```bash
docker build -t chordplay .
docker compose up -d
```

## Library

Drop files anywhere under `LIBRARY_PATH`. Nested subdirectories are fine. Supported formats:

- **ChordPro** (`.pro`, `.cho`) — rendered with inline chord diagrams
- **ASCII tab** (`.txt`) — rendered as monospace text
- **Guitar Pro** (`.gp`, `.gpx`, `.gp5`) — rendered via alphaTab

Metadata is read from:
1. ChordPro directives: `{title: ...}`, `{artist: ...}`, `{spotify_track_id: ...}`
2. Filename pattern: `Artist - Title.ext`

Adding a `{spotify_track_id: ...}` directive gives an exact, unambiguous match. Without it the app uses fuzzy title + artist matching.

## Testing

```bash
npm test           # unit + integration (Vitest)
npm run test:e2e   # end-to-end (Playwright)
npm run lint
npx tsc            # type check
```

## A note on copyright and usage

Chord sheets from external sources (Ultimate Guitar, Chordie, etc.) are covered by music publishing rights. This app is intended for personal use — the same category as printing out a tab for practice. Running a public instance that serves chord sheets to arbitrary users would create copyright exposure.

Spotify's Development Mode is limited to 25 users. Going beyond that requires a [Commercial Developer agreement](https://developer.spotify.com/documentation/commercial-product) with Spotify.
