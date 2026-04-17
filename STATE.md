# State: Chordplay

## Current status
**v0.1.0 LIVE** at https://chords.dougall.ca (rpi5 homelab). Health check passes.

## Deployment
- Image: `forgejo.dougall.ca/joshdougall/chordplay:latest` (built by Forgejo Actions, ARM64)
- Host: rpi5 (192.168.30.15), via Traefik, LAN-only DNS
- Config: `homelab-infra/ansible/roles/chords/`, playbook `playbooks/rpi5-chords.yml`
- Library bind mount: `/home/automation/services/chords/library` (empty on prod)
- Data bind mount: `/home/automation/services/chords/data` (holds encrypted Spotify tokens, prefs)
- Spotify app redirect URIs: `http://127.0.0.1:3000/api/auth/callback` (local), `https://chords.dougall.ca/api/auth/callback` (prod)

## Build strategy (chose C from options)
- Push to `main` → image tags `:main` + `:<short-sha>`
- Push tag `v*` → image tags `:<semver>` + `:latest` + `:<short-sha>`
- Cache: registry-based (`:buildcache` on the same image)
- Runner: rpi5 Forgejo runner with DinD + `DOCKER_API_VERSION=1.41` (host Docker is 20.10)

## Known gaps (from spec + v1 limitations)
- Connection detection uses `/api/auth/status`; added post-v1 because `/api/now-playing` silently returns `null` when unauthenticated.
- `/api/library/raw/:id` referenced in main page for Guitar Pro files but not implemented; only relevant if `.gp` files are dropped in.
- `stopWatcher` stored in singleton but never invoked on shutdown (no teardown handler).
- ESLint flat-config warning during `next lint` (harmless; `.eslintrc.json` vs ESLint 9 flat).

## Next up
1. **Transpose buttons** (A) — ChordSheetJS `.transpose(n)`, UI `+1/-1` buttons, persist per-song in prefs.
2. **Library browser + search** (B) — `/library` page, `/api/library/all` route, Spotify search endpoint.
3. **External fallback** (C) — Ultimate Guitar scrape when match is null, offer as quick-add prefill.

## Docs
- Spec: `docs/superpowers/specs/2026-04-16-chordplay-design.md`
- Plan: `docs/superpowers/plans/2026-04-16-chordplay.md`
