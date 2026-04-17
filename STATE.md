# State: Chordplay

## Current status
**v0.5.0 in-flight** (build running). Live on prod: v0.4.0 at https://chords.dougall.ca. Health 200.

## Versions shipped
- v0.1.0 — initial deployment (29-task plan complete)
- v0.1.1 — retag (no code change)
- v0.2.0 — Spotify callback redirect-origin fix (no more `db95b0b5b8ce:3000` leaks)
- v0.2.1 — multi-source external chords (chordie + e-chords; e-chords blocked by Cloudflare but provider chain still valid)
- v0.3.0 — multi-user: per-user tokens + prefs, shared library, encrypted session cookie
- v0.4.0 — app shell with tabbed nav, Add page, Settings page
- v0.5.0 — warm songbook branding, album art grid, keyboard shortcuts + Spotify playback control (pending build/deploy)

## Deployment
- Image: `forgejo.dougall.ca/joshdougall/chordplay:latest` (Forgejo Actions builds on every main push + tag push, ARM64)
- Host: rpi5 (192.168.30.15), Ansible role `homelab-infra/ansible/roles/chords/`, playbook `playbooks/rpi5-chords.yml`
- Traefik route: `chords.dougall.ca`, LAN-only DNS
- Build strategy: main push → `:main` + `:<sha>`; tag v* → `:<semver>` + `:latest` + `:<sha>`; registry-based build cache
- Ansible role pulls image on every run (`pull: always`)

## Multi-user model
- Shared library (everyone sees same songs)
- Per-user tokens under `/data/users/<spotifyId>/tokens.json`
- Per-user prefs under `/data/users/<spotifyId>/prefs.json`
- Session cookie `cp_session` (AES-GCM encrypted using APP_SECRET)
- Josh is signed in; wife can sign in once her Spotify email is added to dev dashboard user allowlist

## External chord sources
- **chordie.com** — works (plain fetch)
- **e-chords.com** — Cloudflare blocked; provider exists but returns null on real fetches
- **Ultimate Guitar** — Cloudflare blocked; no implementation
- Provider registry in `lib/external/chords.ts` tries in order, caches hits AND misses

## Spotify scopes
- `user-read-playback-state` — now-playing
- `user-read-currently-playing` — same
- `user-modify-playback-state` — NEW in v0.5.0 for keyboard play/pause/skip
  - Existing users need to "re-auth" (Settings page has a button) to get the new scope

## Keyboard shortcuts
- Space / k — play/pause
- j / ← — previous track
- l / → — next track
- t — transpose up
- Shift+T — transpose down
- 0 — reset transpose
- a — toggle auto-scroll
- e — edit current sheet
- / — focus filter input on /library
- ? — shortcuts help overlay

## Pending Ansible changes (homelab-infra work)

For the report-issue feature to work in production, apply these changes in `homelab-infra`:

1. **`ansible/group_vars/all/vault.yml`** — add:
   ```
   vault_chords_forgejo_issue_token: "<Forgejo PAT with write:issue scope>"
   ```

2. **`ansible/roles/chords/defaults/main.yml`** — add:
   ```yaml
   chords_forgejo_issue_token: "{{ vault_chords_forgejo_issue_token }}"
   ```

3. **`ansible/roles/chords/templates/docker-compose.yml.j2`** — add to env block:
   ```
   FORGEJO_BASE_URL: "https://forgejo.dougall.ca"
   FORGEJO_ISSUE_REPO: "joshdougall/chordplay"
   FORGEJO_ISSUE_TOKEN: "{{ chords_forgejo_issue_token }}"
   ```

Until these are applied, `FORGEJO_ISSUE_TOKEN` will be absent and the Report Issue button will be hidden automatically (API returns 503).

## Known gaps / follow-ups
- ESLint flat-config warning (harmless, pre-existing)
- `stopWatcher` stored in singleton, never invoked on shutdown (no teardown hook)
- e-chords provider fully coded but blocked by Cloudflare; keep for future (if Playwright sidecar etc.)
- No batch playlist download yet (talked about it; not built)
- No transpose default setting; it's per-song only
- `/api/library/raw/:id` referenced for Guitar Pro files but not implemented; only matters if user drops .gp files in
- Chord diagram hover popovers on inline `.chord` spans — palette-only for now, hover is a follow-up

## Docs
- Spec: `docs/superpowers/specs/2026-04-16-chordplay-design.md`
- Plan: `docs/superpowers/plans/2026-04-16-chordplay.md`
