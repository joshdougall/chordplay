# CLAUDE.md for chordplay

## Project Overview
Next.js 15 web application for Spotify-synced chord sheets and tabs.
- **Frontend:** React 19, Tailwind CSS, Next.js App Router.
- **State/Data:** SQLite (better-sqlite3) for internal tracking, local filesystem for library files.
- **Auth:** Spotify OAuth.

## Commands
- **Dev:** `npm run dev`
- **Build:** `npm run build`
- **Lint:** `npm run lint`
- **Test (Unit/Integration):** `npm test` (Vitest)
- **Test (E2E):** `npm run test:e2e` (Playwright)
- **Typecheck:** `npx tsc`

## Conventions & Style
- **Components:** Functional components with TypeScript, use `@/components/...` alias.
- **Styling:** Tailwind CSS, avoid custom CSS unless necessary.
- **Naming:** CamelCase for files, PascalCase for components.
- **Patterns:** Server Components by default, `"use client"` only where interactivity is required.
- **Icons:** Lucide React or raw SVGs as needed.

## Library Support
- **Formats:** ChordPro (`.pro`, `.cho`), ASCII tab (`.txt`), Guitar Pro (`.gp`, `.gpx`, `.gp5`).
- **Metadata:** Parsed from ChordPro directives or filename (`Artist - Title.ext`).

**Continuity policy:** Project guidance is authored in `CLAUDE.md` only. `AGENTS.md`, `GEMINI.md`, and `.github/copilot-instructions.md` are short pointers that route each tool to the same source of truth.
