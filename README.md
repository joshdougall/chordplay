# Chordplay

Single-user web app that shows chord sheets and tabs for whatever Spotify is currently playing, with optional playback-synced auto-scroll.

## Local development

```bash
npm install
cp .env.example .env.local  # fill in values
npm run dev
```

### Required environment variables

| Var | Purpose |
|---|---|
| `APP_SECRET` | 32 bytes of randomness, base64 encoded. Use `openssl rand -base64 32`. |
| `SPOTIFY_CLIENT_ID` | From https://developer.spotify.com/dashboard |
| `SPOTIFY_CLIENT_SECRET` | Same |
| `SPOTIFY_REDIRECT_URI` | Must match what's registered in the Spotify app, e.g. `http://localhost:3000/api/auth/callback` for local dev. |
| `LIBRARY_PATH` | Absolute path to your chord/tab library directory. |
| `DATA_PATH` | Absolute path to writable dir for `tokens.json` and `prefs.json`. |

## Library format

Drop ChordPro (`.pro`, `.cho`), ASCII tab (`.txt`), or Guitar Pro (`.gp`, `.gpx`, `.gp5`) files anywhere under `LIBRARY_PATH`. Nested subfolders are fine.

Metadata is pulled from:
1. ChordPro directives inside the file: `{title: ...}`, `{artist: ...}`, `{spotify_track_id: ...}`
2. Filename in the form `Artist - Title.ext`
3. Fallback: the filename becomes the title

The `spotify_track_id` directive gives you an exact, unambiguous match. Without it the app falls back to normalized title+artist matching, then a fuzzy match.

## Editing

Click "Edit" on any displayed sheet. Changes are written back to the file on disk. No database.

## Deployment

See the `chords` Ansible role in `homelab-infra` for the production deployment (Traefik, bind mounts, vault secrets).

## Testing

```bash
npm test
```

## Spec & design

- `docs/superpowers/specs/2026-04-16-chordplay-design.md` — full design
- `docs/superpowers/plans/2026-04-16-chordplay.md` — implementation plan
