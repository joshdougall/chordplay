# Chordplay

Shows chord sheets and guitar tabs for your currently playing track, with playback-synced auto-scroll. Chord sheets are fetched automatically from Ultimate Guitar, Chordie, and other sources, or you can add your own files.

## Features

- Auto-fetches chord sheets when a song starts playing
- ChordPro, ASCII tab, and Guitar Pro file support
- Chord diagrams with correct voicings (including slash chord inversions like D/C, G/B)
- Transpose + capo suggestions
- Per-user library with multi-version support
- Playlist browser with batch chord import
- Auto-scroll with speed control
- Multi-user (each user connects their own streaming account)

## Prerequisites

- Node.js 22+
- Developer API credentials for your music streaming service (for example, a [Spotify Developer app](https://developer.spotify.com/dashboard))

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
| `SPOTIFY_CLIENT_ID` | From your streaming service developer dashboard |
| `SPOTIFY_CLIENT_SECRET` | From your streaming service developer dashboard |
| `SPOTIFY_REDIRECT_URI` | Must exactly match what's registered in your app |
| `LIBRARY_PATH` | Directory where chord/tab files are stored |
| `DATA_PATH` | Directory for user tokens, prefs, and cache |

### Optional

| Variable | Default | Description |
|---|---|---|
| `LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error` |
| `CHORDPLAY_ADMIN_USERS` | _(none)_ | Comma-separated user IDs with access to `/settings/admin` |

## Docker

Pre-built images for `linux/amd64` and `linux/arm64` are published to GitHub Container Registry on every release.

**Quick start:**

```bash
cp .env.example .env
# fill in .env, then:

# docker run
docker run -d \
  --name chordplay \
  -p 3000:3000 \
  --env-file .env \
  -e HOSTNAME=0.0.0.0 \
  -v ./library:/data/library \
  -v ./appdata:/data/app \
  ghcr.io/joshdougall/chordplay:latest

# or docker compose (docker-compose.yml included)
docker compose up -d
```

Pin to a specific version:

```bash
ghcr.io/joshdougall/chordplay:1.0.0
```

To build from source, replace `image:` in `docker-compose.yml` with `build: .` and run `docker compose up -d --build`.

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

## License

MIT. See [LICENSE](LICENSE). Before running a public instance, read the copyright note below — the license covers the code, not the chord sheet content it fetches.

## A note on copyright and usage

Chord sheets from external sources (Ultimate Guitar, Chordie, etc.) are covered by music publishing rights. This app is intended for personal use — the same category as printing out a tab for practice. Running a public instance that serves chord sheets to arbitrary users would create copyright exposure.
