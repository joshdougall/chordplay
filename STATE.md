# State: Chordplay

## Current status
**v0.6.1 batch commits in worktree** (agent-a73df64c). Live on prod: v0.6.1 at https://chords.dougall.ca.

## Re-auth required
New Spotify scopes added in this batch:
- `user-read-recently-played` — last-played fallback
- `playlist-read-private` — playlist browser
- `playlist-read-collaborative` — shared playlists
Users must visit Settings → "Logout & reconnect" to grant new scopes.

## Versions shipped
- v0.1.0 — initial deployment
- v0.2.0 — Spotify callback redirect-origin fix
- v0.2.1 — multi-source external chords (chordie + e-chords)
- v0.3.0 — multi-user: per-user tokens + prefs, shared library
- v0.4.0 — app shell with tabbed nav, Add page, Settings page
- v0.5.0 — warm songbook branding, keyboard shortcuts, Spotify playback control
- v0.6.1 — (committed to worktree, not yet merged/tagged) batch feature work

## What was done in this agent session (worktree agent-a73df64c)
1. `fix(add): sync internal track state when initialTrack prop changes`
2. `feat(matcher): weighted artist+title fuzzy, 0.90 threshold, expose score + wrong-match flow`
3. `feat(now-playing): fall back to last-played when Spotify idle`
4. `feat(library): persist spotify_track_id to file on match detection`
5. `feat(ui): show app version in header and settings`
6. `feat(playlists): spotify playlist browser with batch chord import`
7. `feat(library): multi-version per song with picker and duplicate action`
8. `fix(types): add type annotations to playlist routes, add preferredVersion to prefs test fixtures`

## Deployment
- Image: `forgejo.dougall.ca/joshdougall/chordplay:latest`
- Host: rpi5 (192.168.30.15), Ansible role `homelab-infra/ansible/roles/chords/`
- Traefik route: `chords.dougall.ca`, LAN-only DNS

## External chord sources
- **chordie.com** — works (plain fetch)
- **e-chords.com** — Cloudflare blocked
- Provider registry in `lib/external/chords.ts` tries in order, caches hits AND misses

## Spotify scopes (full list after this batch)
- `user-read-playback-state`
- `user-read-currently-playing`
- `user-modify-playback-state`
- `user-read-recently-played` (NEW)
- `playlist-read-private` (NEW)
- `playlist-read-collaborative` (NEW)

## Keyboard shortcuts
- Space / k — play/pause
- j / ← — previous track
- l / → — next track
- t — transpose up
- Shift+T — transpose down
- 0 — reset transpose
- a — toggle auto-scroll
- e — edit current sheet
- ? — shortcuts help overlay

## Known gaps / follow-ups
- Build in worktree fails at "Collecting page data" due to Next.js relative path issue in git worktrees (not caused by code changes; builds fine in main repo)
- ESLint flat-config warning (harmless, pre-existing)
- e-chords provider blocked by Cloudflare
- `/api/library/raw/:id` not implemented (Guitar Pro files only)
- Playlist import only does Chordie sequential requests; polite but slow for big playlists

## Docs
- Spec: `docs/superpowers/specs/2026-04-16-chordplay-design.md`
