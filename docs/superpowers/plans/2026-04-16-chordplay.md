# Chordplay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-user Next.js web app that shows ChordPro chord sheets or Guitar Pro / ASCII tabs for whatever Spotify is currently playing, with optional pace-based auto-scroll, edits persisted to files on disk.

**Architecture:** One Next.js 15 container, no database. Filesystem is the source of truth for the chord/tab library; runtime state (encrypted Spotify refresh token, user prefs) lives in JSON files on a separate bind-mount volume. In-memory library index is built on boot and kept live by a chokidar file watcher. Spotify OAuth (Authorization Code + PKCE) is server-side; access tokens stay in memory, refresh tokens are encrypted at rest with AES-GCM. The client polls a server-side now-playing endpoint (1s upstream cache) and fetches a library match whenever the track changes.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind, Node 22, `chordsheetjs`, `@coderline/alphatab`, `chokidar`, `vitest`. No external DB.

**Related spec:** `docs/superpowers/specs/2026-04-16-chordplay-design.md`

---

## File Structure

```
chordplay/
├── package.json
├── tsconfig.json
├── next.config.mjs
├── tailwind.config.ts
├── postcss.config.mjs
├── vitest.config.ts
├── .eslintrc.json
├── .gitignore
├── .dockerignore
├── Dockerfile
├── README.md
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts
│       │   ├── callback/route.ts
│       │   └── logout/route.ts
│       ├── now-playing/route.ts
│       ├── library/
│       │   ├── route.ts             # POST = create
│       │   ├── match/route.ts       # GET = match current track
│       │   └── [id]/route.ts        # GET + PUT
│       ├── prefs/route.ts
│       └── health/route.ts
├── lib/
│   ├── config.ts                    # env var loading + validation
│   ├── auth/
│   │   ├── crypto.ts                # AES-GCM encrypt/decrypt
│   │   ├── tokens.ts                # tokens.json read/write
│   │   ├── pkce.ts                  # PKCE verifier/challenge/state
│   │   └── spotify.ts               # access-token accessor (lazy refresh)
│   ├── spotify/
│   │   ├── client.ts                # fetch wrapper with auth + retry
│   │   └── now-playing-cache.ts     # 1-second cache
│   ├── library/
│   │   ├── normalize.ts             # title/artist normalization + levenshtein
│   │   ├── parser.ts                # ChordPro directive & filename parsing
│   │   ├── format.ts                # detect ChordPro / ASCII tab / Guitar Pro
│   │   ├── index.ts                 # singleton index: scan + maps
│   │   ├── watcher.ts               # chokidar integration
│   │   ├── matcher.ts               # track → library entry
│   │   └── editor.ts                # atomic write + path sanitization
│   └── prefs/
│       └── store.ts                 # prefs.json read/write
├── components/
│   ├── ChordProView.tsx
│   ├── TabView.tsx
│   ├── AutoScroller.tsx
│   ├── NowPlayingHeader.tsx
│   ├── ConnectSpotify.tsx
│   ├── QuickAddForm.tsx
│   └── Editor.tsx
├── hooks/
│   ├── useNowPlaying.ts
│   └── usePrefs.ts
└── tests/
    └── lib/
        ├── auth/
        │   ├── crypto.test.ts
        │   ├── tokens.test.ts
        │   └── pkce.test.ts
        ├── spotify/
        │   └── now-playing-cache.test.ts
        ├── library/
        │   ├── normalize.test.ts
        │   ├── parser.test.ts
        │   ├── format.test.ts
        │   ├── matcher.test.ts
        │   ├── editor.test.ts
        │   └── fixtures/           # sample .pro, .txt, .gp files
        └── prefs/
            └── store.test.ts
```

---

## Conventions used in this plan

- Every task ends with a commit step. Commit messages use `feat:`, `test:`, `chore:`, or `fix:` prefixes (Conventional Commits).
- TypeScript: `strict: true`, no implicit any, ESM imports.
- Tests use `vitest`. Server-side tests run in the Node environment; no component tests in v1.
- Each code step shows the full file contents when creating a new file, or the exact replacement chunk when editing an existing file.
- Paths are relative to the repo root `/Users/josh/dev/personal/chordplay/`.
- Commit hash in spec already exists: `317548d Add chordplay v1 design spec`. Start the implementation from there.

---

## Task 1: Scaffold the Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `.eslintrc.json`, `.gitignore`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `vitest.config.ts`

- [ ] **Step 1: Initialize `package.json`**

```json
{
  "name": "chordplay",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@coderline/alphatab": "^1.4.1",
    "chokidar": "^3.6.0",
    "chordsheetjs": "^12.0.0",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "^15.0.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.6.0",
    "vitest": "^2.0.0"
  }
}
```

Note: versions listed are minimum-compatible baselines; bump to latest-stable during implementation if needed.

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "jsx": "preserve",
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["chokidar", "@coderline/alphatab"]
  }
};

export default nextConfig;
```

- [ ] **Step 4: Create `tailwind.config.ts` and `postcss.config.mjs`**

`tailwind.config.ts`:
```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: []
};

export default config;
```

`postcss.config.mjs`:
```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};
```

- [ ] **Step 5: Create ESLint config**

`.eslintrc.json`:
```json
{ "extends": ["next/core-web-vitals", "next/typescript"] }
```

- [ ] **Step 6: Create `.gitignore`**

```
node_modules
.next
out
.DS_Store
*.log
.env*.local
.env
coverage
next-env.d.ts
```

- [ ] **Step 7: Create `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body { height: 100%; }
body { @apply bg-neutral-950 text-neutral-100; }
```

- [ ] **Step 8: Create `app/layout.tsx`**

```tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chordplay",
  description: "Chord sheets and tabs that follow Spotify playback"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 9: Create placeholder `app/page.tsx`**

```tsx
export default function HomePage() {
  return <main className="p-8"><h1 className="text-2xl">Chordplay</h1></main>;
}
```

- [ ] **Step 10: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: true
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./") }
  }
});
```

- [ ] **Step 11: Install and verify build**

Run:
```bash
npm install
npm run build
npm run lint
npm test -- --run
```

Expected: install completes, build produces `.next/standalone`, lint passes, vitest reports "No test files found" (exit 0 with `passWithNoTests` or non-zero — if non-zero, add `--passWithNoTests` flag to the script).

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: scaffold next.js project with typescript, tailwind, vitest"
```

---

## Task 2: Configuration module

**Files:**
- Create: `lib/config.ts`
- Create: `tests/lib/config.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/lib/config.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig, ConfigError } from "@/lib/config";

const REQUIRED = {
  APP_SECRET: "a".repeat(44), // 32 bytes base64 ≈ 44 chars
  SPOTIFY_CLIENT_ID: "cid",
  SPOTIFY_CLIENT_SECRET: "csec",
  SPOTIFY_REDIRECT_URI: "https://chords.dougall.ca/api/auth/callback",
  LIBRARY_PATH: "/tmp/lib",
  DATA_PATH: "/tmp/data"
};

describe("loadConfig", () => {
  const original = { ...process.env };
  beforeEach(() => {
    for (const k of Object.keys(REQUIRED)) delete process.env[k];
  });
  afterEach(() => { process.env = { ...original }; });

  it("loads valid env", () => {
    Object.assign(process.env, REQUIRED);
    const cfg = loadConfig();
    expect(cfg.spotifyClientId).toBe("cid");
    expect(cfg.libraryPath).toBe("/tmp/lib");
    expect(cfg.appSecret).toBeInstanceOf(Buffer);
    expect(cfg.appSecret.length).toBe(32);
  });

  it("throws on missing var", () => {
    Object.assign(process.env, REQUIRED);
    delete process.env.SPOTIFY_CLIENT_ID;
    expect(() => loadConfig()).toThrow(ConfigError);
  });

  it("throws on invalid APP_SECRET length", () => {
    Object.assign(process.env, REQUIRED, { APP_SECRET: "short" });
    expect(() => loadConfig()).toThrow(/APP_SECRET/);
  });
});
```

- [ ] **Step 2: Run test, confirm failure**

Run: `npm test -- --run lib/config`
Expected: module not found / fails to import.

- [ ] **Step 3: Implement `lib/config.ts`**

```ts
export class ConfigError extends Error {}

export type Config = {
  appSecret: Buffer;
  spotifyClientId: string;
  spotifyClientSecret: string;
  spotifyRedirectUri: string;
  libraryPath: string;
  dataPath: string;
  logLevel: "debug" | "info" | "warn" | "error";
};

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new ConfigError(`Missing required env var: ${name}`);
  return v;
}

export function loadConfig(): Config {
  const secretB64 = required("APP_SECRET");
  const buf = Buffer.from(secretB64, "base64");
  if (buf.length !== 32) {
    throw new ConfigError(`APP_SECRET must decode to exactly 32 bytes (got ${buf.length})`);
  }
  const level = (process.env.LOG_LEVEL ?? "info") as Config["logLevel"];
  return {
    appSecret: buf,
    spotifyClientId: required("SPOTIFY_CLIENT_ID"),
    spotifyClientSecret: required("SPOTIFY_CLIENT_SECRET"),
    spotifyRedirectUri: required("SPOTIFY_REDIRECT_URI"),
    libraryPath: required("LIBRARY_PATH"),
    dataPath: required("DATA_PATH"),
    logLevel: ["debug", "info", "warn", "error"].includes(level) ? level : "info"
  };
}

let cached: Config | null = null;
export function getConfig(): Config {
  if (!cached) cached = loadConfig();
  return cached;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- --run lib/config`
Expected: all three tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/config.ts tests/lib/config.test.ts
git commit -m "feat(config): load and validate env config"
```

---

## Task 3: AES-GCM crypto for token encryption

**Files:**
- Create: `lib/auth/crypto.ts`
- Create: `tests/lib/auth/crypto.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/lib/auth/crypto.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { encrypt, decrypt } from "@/lib/auth/crypto";

describe("crypto", () => {
  const key = randomBytes(32);

  it("round-trips a payload", () => {
    const plaintext = "refresh-token-xyz";
    const blob = encrypt(plaintext, key);
    const out = decrypt(blob, key);
    expect(out).toBe(plaintext);
  });

  it("fails with wrong key", () => {
    const blob = encrypt("hello", key);
    expect(() => decrypt(blob, randomBytes(32))).toThrow();
  });

  it("produces different ciphertext for same plaintext (nonce randomness)", () => {
    const a = encrypt("same", key);
    const b = encrypt("same", key);
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run test, confirm failure**

Run: `npm test -- --run lib/auth/crypto`
Expected: module not found.

- [ ] **Step 3: Implement `lib/auth/crypto.ts`**

```ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

// Blob format: base64(iv | authTag | ciphertext)
export function encrypt(plaintext: string, key: Buffer): string {
  if (key.length !== 32) throw new Error("Key must be 32 bytes");
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decrypt(blob: string, key: Buffer): string {
  if (key.length !== 32) throw new Error("Key must be 32 bytes");
  const buf = Buffer.from(blob, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + 16);
  const enc = buf.subarray(IV_LEN + 16);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- --run lib/auth/crypto`
Expected: all three tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/crypto.ts tests/lib/auth/crypto.test.ts
git commit -m "feat(auth): add aes-gcm encrypt/decrypt for tokens"
```

---

## Task 4: Token store (persist refresh token to disk)

**Files:**
- Create: `lib/auth/tokens.ts`
- Create: `tests/lib/auth/tokens.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/lib/auth/tokens.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { readTokens, writeTokens, deleteTokens } from "@/lib/auth/tokens";

describe("token store", () => {
  let dir: string;
  const key = randomBytes(32);

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "chordplay-")); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("returns null when tokens file is absent", async () => {
    expect(await readTokens(dir, key)).toBeNull();
  });

  it("writes and reads encrypted tokens", async () => {
    await writeTokens(dir, key, { refreshToken: "r1", scopes: ["s1"], issuedAt: 1000 });
    const out = await readTokens(dir, key);
    expect(out).toEqual({ refreshToken: "r1", scopes: ["s1"], issuedAt: 1000 });
  });

  it("delete removes the file", async () => {
    await writeTokens(dir, key, { refreshToken: "r1", scopes: [], issuedAt: 0 });
    await deleteTokens(dir);
    expect(await readTokens(dir, key)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test, confirm failure**

Run: `npm test -- --run lib/auth/tokens`
Expected: module not found.

- [ ] **Step 3: Implement `lib/auth/tokens.ts`**

```ts
import { readFile, writeFile, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { encrypt, decrypt } from "./crypto";

export type Tokens = {
  refreshToken: string;
  scopes: string[];
  issuedAt: number; // epoch ms
};

type Stored = { blob: string; scopes: string[]; issuedAt: number };

const FILE = "tokens.json";

export async function readTokens(dataDir: string, key: Buffer): Promise<Tokens | null> {
  try {
    const raw = await readFile(join(dataDir, FILE), "utf8");
    const stored = JSON.parse(raw) as Stored;
    const refreshToken = decrypt(stored.blob, key);
    return { refreshToken, scopes: stored.scopes, issuedAt: stored.issuedAt };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function writeTokens(dataDir: string, key: Buffer, tokens: Tokens): Promise<void> {
  const stored: Stored = {
    blob: encrypt(tokens.refreshToken, key),
    scopes: tokens.scopes,
    issuedAt: tokens.issuedAt
  };
  const path = join(dataDir, FILE);
  const tmp = `${path}.tmp.${process.pid}`;
  await writeFile(tmp, JSON.stringify(stored), { mode: 0o600 });
  await rename(tmp, path);
}

export async function deleteTokens(dataDir: string): Promise<void> {
  try { await unlink(join(dataDir, FILE)); }
  catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- --run lib/auth/tokens`
Expected: all three tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/tokens.ts tests/lib/auth/tokens.test.ts
git commit -m "feat(auth): add token store with atomic writes"
```

---

## Task 5: PKCE utilities

**Files:**
- Create: `lib/auth/pkce.ts`
- Create: `tests/lib/auth/pkce.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/lib/auth/pkce.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createVerifier, challengeFor, createState } from "@/lib/auth/pkce";
import { createHash } from "node:crypto";

describe("pkce", () => {
  it("creates a URL-safe verifier of valid length", () => {
    const v = createVerifier();
    expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(v.length).toBeGreaterThanOrEqual(43);
    expect(v.length).toBeLessThanOrEqual(128);
  });

  it("challenge is sha256 of verifier, base64url, no padding", () => {
    const v = "verifier-example";
    const expected = createHash("sha256").update(v).digest("base64url");
    expect(challengeFor(v)).toBe(expected);
  });

  it("state is a distinct random string each call", () => {
    const a = createState();
    const b = createState();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
```

- [ ] **Step 2: Run test, confirm failure**

Run: `npm test -- --run lib/auth/pkce`
Expected: module not found.

- [ ] **Step 3: Implement `lib/auth/pkce.ts`**

```ts
import { createHash, randomBytes } from "node:crypto";

export function createVerifier(): string {
  return randomBytes(48).toString("base64url"); // ~64 chars
}

export function challengeFor(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function createState(): string {
  return randomBytes(16).toString("base64url");
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- --run lib/auth/pkce`
Expected: all three tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/pkce.ts tests/lib/auth/pkce.test.ts
git commit -m "feat(auth): add pkce verifier/challenge/state helpers"
```

---

## Task 6: /api/auth/login route

**Files:**
- Create: `app/api/auth/login/route.ts`

- [ ] **Step 1: Implement the route**

No unit test for route in v1; manual smoke test after deploy.

```ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getConfig } from "@/lib/config";
import { createVerifier, challengeFor, createState } from "@/lib/auth/pkce";

const SCOPES = [
  "user-read-playback-state",
  "user-read-currently-playing"
].join(" ");

export async function GET() {
  const cfg = getConfig();
  const verifier = createVerifier();
  const challenge = challengeFor(verifier);
  const state = createState();

  const cookieStore = await cookies();
  const opts = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: 600 };
  cookieStore.set("cp_pkce", verifier, opts);
  cookieStore.set("cp_state", state, opts);

  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.set("client_id", cfg.spotifyClientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", cfg.spotifyRedirectUri);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", SCOPES);

  return NextResponse.redirect(url.toString(), { status: 302 });
}
```

- [ ] **Step 2: Typecheck & lint**

Run: `npm run lint && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/login/route.ts
git commit -m "feat(auth): add spotify login route with pkce"
```

---

## Task 7: /api/auth/callback route

**Files:**
- Create: `app/api/auth/callback/route.ts`

- [ ] **Step 1: Implement the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getConfig } from "@/lib/config";
import { writeTokens } from "@/lib/auth/tokens";

export async function GET(req: NextRequest) {
  const cfg = getConfig();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  if (err) return NextResponse.redirect(new URL("/?error=" + encodeURIComponent(err), req.url));
  if (!code || !state) return NextResponse.json({ error: "missing code or state" }, { status: 400 });

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("cp_state")?.value;
  const verifier = cookieStore.get("cp_pkce")?.value;
  if (!expectedState || !verifier || expectedState !== state) {
    return NextResponse.json({ error: "state mismatch" }, { status: 400 });
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: cfg.spotifyRedirectUri,
    client_id: cfg.spotifyClientId,
    code_verifier: verifier
  });

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${cfg.spotifyClientId}:${cfg.spotifyClientSecret}`).toString("base64")
    },
    body
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    return NextResponse.json({ error: "token exchange failed", detail: text }, { status: 502 });
  }

  const data = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    scope: string;
    expires_in: number;
    token_type: string;
  };

  await writeTokens(cfg.dataPath, cfg.appSecret, {
    refreshToken: data.refresh_token,
    scopes: data.scope.split(" "),
    issuedAt: Date.now()
  });

  // Also stash access token in a short-lived encrypted cookie? No — keep it in-memory via the access-token module (Task 9).
  // The access-token module can bootstrap itself from the refresh token on next call.

  cookieStore.delete("cp_pkce");
  cookieStore.delete("cp_state");

  return NextResponse.redirect(new URL("/", req.url));
}
```

- [ ] **Step 2: Typecheck & lint**

Run: `npm run lint && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/callback/route.ts
git commit -m "feat(auth): add spotify callback route with token exchange"
```

---

## Task 8: /api/auth/logout route

**Files:**
- Create: `app/api/auth/logout/route.ts`

- [ ] **Step 1: Implement the route**

```ts
import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { deleteTokens } from "@/lib/auth/tokens";
import { clearAccessTokenCache } from "@/lib/auth/spotify";

export async function POST() {
  const cfg = getConfig();
  await deleteTokens(cfg.dataPath);
  clearAccessTokenCache();
  return NextResponse.json({ ok: true });
}
```

Note: `clearAccessTokenCache` is defined in Task 9. This route will not compile until Task 9 is merged.

- [ ] **Step 2: Commit (wait to typecheck until Task 9)**

```bash
git add app/api/auth/logout/route.ts
git commit -m "feat(auth): add logout route"
```

---

## Task 9: Spotify access-token accessor with lazy refresh

**Files:**
- Create: `lib/auth/spotify.ts`
- Create: `tests/lib/auth/spotify.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/lib/auth/spotify.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { writeTokens } from "@/lib/auth/tokens";
import { getAccessToken, clearAccessTokenCache, _setFetcherForTest } from "@/lib/auth/spotify";

describe("getAccessToken", () => {
  let dir: string;
  const key = randomBytes(32);

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "chordplay-"));
    clearAccessTokenCache();
    await writeTokens(dir, key, { refreshToken: "r", scopes: [], issuedAt: 0 });
  });

  it("fetches and caches a fresh access token", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({ access_token: "atok", expires_in: 3600, token_type: "Bearer" })
    }));
    _setFetcherForTest(fetcher as unknown as typeof fetch);

    const cfg = { dataPath: dir, appSecret: key, spotifyClientId: "c", spotifyClientSecret: "s" };
    const t1 = await getAccessToken(cfg as any);
    const t2 = await getAccessToken(cfg as any);
    expect(t1).toBe("atok");
    expect(t2).toBe("atok");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("refreshes when cached token is within 30s of expiry", async () => {
    let n = 0;
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({ access_token: `tok-${++n}`, expires_in: 10, token_type: "Bearer" })
    }));
    _setFetcherForTest(fetcher as unknown as typeof fetch);
    const cfg = { dataPath: dir, appSecret: key, spotifyClientId: "c", spotifyClientSecret: "s" };
    const first = await getAccessToken(cfg as any);
    expect(first).toBe("tok-1");
    const second = await getAccessToken(cfg as any);
    expect(second).toBe("tok-2");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("throws if no tokens on disk", async () => {
    clearAccessTokenCache();
    rmSync(dir, { recursive: true, force: true });
    const newDir = mkdtempSync(join(tmpdir(), "chordplay-"));
    const cfg = { dataPath: newDir, appSecret: key, spotifyClientId: "c", spotifyClientSecret: "s" };
    await expect(getAccessToken(cfg as any)).rejects.toThrow(/not authenticated/);
  });
});
```

- [ ] **Step 2: Run test, confirm failure**

Run: `npm test -- --run lib/auth/spotify`
Expected: module not found.

- [ ] **Step 3: Implement `lib/auth/spotify.ts`**

```ts
import { readTokens, writeTokens } from "./tokens";
import type { Config } from "../config";

type Cached = { accessToken: string; expiresAt: number };
let cache: Cached | null = null;
let fetcher: typeof fetch = fetch;

export function _setFetcherForTest(f: typeof fetch) { fetcher = f; }
export function clearAccessTokenCache() { cache = null; }

const REFRESH_MARGIN_MS = 30_000;

export async function getAccessToken(cfg: Config): Promise<string> {
  if (cache && cache.expiresAt - Date.now() > REFRESH_MARGIN_MS) {
    return cache.accessToken;
  }
  const tokens = await readTokens(cfg.dataPath, cfg.appSecret);
  if (!tokens) throw new Error("not authenticated");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokens.refreshToken,
    client_id: cfg.spotifyClientId
  });
  const res = await fetcher("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${cfg.spotifyClientId}:${cfg.spotifyClientSecret}`).toString("base64")
    },
    body
  });
  if (!res.ok) throw new Error(`token refresh failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number; refresh_token?: string };
  cache = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };

  // Spotify sometimes rotates refresh tokens; persist if so.
  if (data.refresh_token && data.refresh_token !== tokens.refreshToken) {
    await writeTokens(cfg.dataPath, cfg.appSecret, {
      ...tokens,
      refreshToken: data.refresh_token,
      issuedAt: Date.now()
    });
  }
  return cache.accessToken;
}
```

- [ ] **Step 4: Run tests (auth + callback now type-check)**

Run: `npm test -- --run lib/auth/spotify && npx tsc --noEmit`
Expected: three tests pass, no type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/spotify.ts tests/lib/auth/spotify.test.ts
git commit -m "feat(auth): add spotify access-token accessor with lazy refresh"
```

---

## Task 10: Now-playing cache + /api/now-playing route

**Files:**
- Create: `lib/spotify/now-playing-cache.ts`
- Create: `tests/lib/spotify/now-playing-cache.test.ts`
- Create: `app/api/now-playing/route.ts`

- [ ] **Step 1: Write the failing test**

`tests/lib/spotify/now-playing-cache.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeNowPlayingCache, NowPlaying } from "@/lib/spotify/now-playing-cache";

describe("now-playing cache", () => {
  beforeEach(() => { vi.useFakeTimers(); });

  it("returns cached value within TTL", async () => {
    const fetcher = vi.fn(async (): Promise<NowPlaying | null> => ({
      trackId: "a", title: "T", artists: ["A"], albumArt: null, progressMs: 0, durationMs: 1, isPlaying: true
    }));
    const cache = makeNowPlayingCache(fetcher, 1000);
    await cache.get();
    await cache.get();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("refreshes after TTL expires", async () => {
    const fetcher = vi.fn(async (): Promise<NowPlaying | null> => ({
      trackId: "a", title: "T", artists: ["A"], albumArt: null, progressMs: 0, durationMs: 1, isPlaying: true
    }));
    const cache = makeNowPlayingCache(fetcher, 1000);
    await cache.get();
    vi.advanceTimersByTime(1500);
    await cache.get();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("coalesces concurrent calls", async () => {
    let resolve!: (v: NowPlaying) => void;
    const fetcher = vi.fn(() => new Promise<NowPlaying>(r => { resolve = r; }));
    const cache = makeNowPlayingCache(fetcher as unknown as () => Promise<NowPlaying>, 1000);
    const p1 = cache.get();
    const p2 = cache.get();
    resolve({ trackId: "a", title: "t", artists: [], albumArt: null, progressMs: 0, durationMs: 1, isPlaying: true });
    await Promise.all([p1, p2]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test, confirm failure**

Run: `npm test -- --run now-playing-cache`
Expected: module not found.

- [ ] **Step 3: Implement `lib/spotify/now-playing-cache.ts`**

```ts
export type NowPlaying = {
  trackId: string;
  title: string;
  artists: string[];
  albumArt: string | null;
  progressMs: number;
  durationMs: number;
  isPlaying: boolean;
} | null;

type Entry = { value: NowPlaying; at: number };

export function makeNowPlayingCache(fetcher: () => Promise<NowPlaying>, ttlMs: number) {
  let entry: Entry | null = null;
  let inflight: Promise<NowPlaying> | null = null;

  return {
    async get(): Promise<NowPlaying> {
      if (entry && Date.now() - entry.at < ttlMs) return entry.value;
      if (inflight) return inflight;
      inflight = (async () => {
        try {
          const v = await fetcher();
          entry = { value: v, at: Date.now() };
          return v;
        } finally {
          inflight = null;
        }
      })();
      return inflight;
    },
    invalidate() { entry = null; }
  };
}
```

- [ ] **Step 4: Run cache tests**

Run: `npm test -- --run now-playing-cache`
Expected: three tests pass.

- [ ] **Step 5: Implement `app/api/now-playing/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { getAccessToken } from "@/lib/auth/spotify";
import { makeNowPlayingCache, type NowPlaying } from "@/lib/spotify/now-playing-cache";

async function fetchFromSpotify(): Promise<NowPlaying> {
  const cfg = getConfig();
  let token: string;
  try { token = await getAccessToken(cfg); }
  catch { return null; }

  const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (res.status === 204) return null; // nothing playing
  if (res.status === 401) {
    // access token lib normally refreshes, but if upstream rotated refresh token
    // and we cached a stale access token, surface null to client.
    return null;
  }
  if (!res.ok) throw new Error(`spotify now-playing ${res.status}`);
  const data = await res.json();
  if (!data || !data.item) return null;
  return {
    trackId: data.item.id,
    title: data.item.name,
    artists: data.item.artists.map((a: { name: string }) => a.name),
    albumArt: data.item.album?.images?.[0]?.url ?? null,
    progressMs: data.progress_ms ?? 0,
    durationMs: data.item.duration_ms ?? 0,
    isPlaying: !!data.is_playing
  };
}

const cache = makeNowPlayingCache(fetchFromSpotify, 1000);

export async function GET() {
  try {
    const np = await cache.get();
    return NextResponse.json(np);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/spotify/now-playing-cache.ts tests/lib/spotify/now-playing-cache.test.ts app/api/now-playing/route.ts
git commit -m "feat(spotify): cache and serve now-playing"
```

---

## Task 11: Normalization & Levenshtein utilities

**Files:**
- Create: `lib/library/normalize.ts`
- Create: `tests/lib/library/normalize.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/lib/library/normalize.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { normalizeKey, levenshteinRatio } from "@/lib/library/normalize";

describe("normalize", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeKey("The Beatles", "Hey Jude!")).toBe("the beatles|hey jude");
  });
  it("trims and collapses whitespace", () => {
    expect(normalizeKey("  Pink  Floyd ", " Money  ")).toBe("pink floyd|money");
  });
  it("removes parenthetical live/remaster markers", () => {
    expect(normalizeKey("Radiohead", "Creep (Acoustic Version)")).toBe("radiohead|creep");
  });
});

describe("levenshteinRatio", () => {
  it("is 1.0 for equal strings", () => {
    expect(levenshteinRatio("abc", "abc")).toBe(1);
  });
  it("is 0 for completely different same-length strings", () => {
    expect(levenshteinRatio("abcd", "wxyz")).toBe(0);
  });
  it("is close to 0.85 for one typo in a 7-char string", () => {
    const r = levenshteinRatio("radiohead", "rodiohead");
    expect(r).toBeGreaterThan(0.85);
  });
});
```

- [ ] **Step 2: Run test, confirm failure**

Run: `npm test -- --run library/normalize`
Expected: module not found.

- [ ] **Step 3: Implement `lib/library/normalize.ts`**

```ts
export function normalizeKey(artist: string, title: string): string {
  return `${clean(artist)}|${clean(title)}`;
}

function clean(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, " ")   // strip parentheticals
    .replace(/[^\p{L}\p{N}\s]/gu, " ")   // strip punctuation (keep letters, numbers, spaces)
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshteinRatio(a: string, b: string): number {
  if (a === b) return 1;
  const d = levenshtein(a, b);
  const m = Math.max(a.length, b.length);
  return m === 0 ? 1 : 1 - d / m;
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- --run library/normalize`
Expected: six tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/library/normalize.ts tests/lib/library/normalize.test.ts
git commit -m "feat(library): add normalization and levenshtein utilities"
```

---

## Task 12: ChordPro / filename parser + format detection

**Files:**
- Create: `lib/library/format.ts`
- Create: `lib/library/parser.ts`
- Create: `tests/lib/library/parser.test.ts`
- Create: `tests/lib/library/fixtures/chord-sample.pro`
- Create: `tests/lib/library/fixtures/ascii-tab.txt`
- Create: `tests/lib/library/fixtures/Artist Name - Song Title.pro`

- [ ] **Step 1: Create fixtures**

`tests/lib/library/fixtures/chord-sample.pro`:
```
{title: Hey Jude}
{artist: The Beatles}
{spotify_track_id: 0aym2LBJBk9DAYuHHutrIl}

[C]Hey Jude, don't make it [G]bad
Take a [G7]sad song and make it [C]better
```

`tests/lib/library/fixtures/ascii-tab.txt`:
```
Song: Example Riff
Artist: Test Artist

e|---0---3---5---|
B|---1---3---5---|
G|---0---0---5---|
D|---2---0---5---|
A|---3---2---3---|
E|---x---3---x---|
```

`tests/lib/library/fixtures/Artist Name - Song Title.pro`:
```
[Am]No directive in this file, parse from filename
```

- [ ] **Step 2: Write the failing tests**

`tests/lib/library/parser.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseMetadata } from "@/lib/library/parser";
import { detectFormat } from "@/lib/library/format";

const F = (name: string) => join(__dirname, "fixtures", name);

describe("detectFormat", () => {
  it(".pro is chordpro", () => {
    expect(detectFormat("x.pro", "anything")).toBe("chordpro");
  });
  it(".gp is guitar-pro", () => {
    expect(detectFormat("x.gp", "")).toBe("guitar-pro");
  });
  it(".txt with tab lines is ascii-tab", () => {
    const content = readFileSync(F("ascii-tab.txt"), "utf8");
    expect(detectFormat("any.txt", content)).toBe("ascii-tab");
  });
  it(".txt without tab lines is chordpro (plain chord sheet)", () => {
    expect(detectFormat("any.txt", "just words")).toBe("chordpro");
  });
});

describe("parseMetadata", () => {
  it("reads chordpro directives", () => {
    const content = readFileSync(F("chord-sample.pro"), "utf8");
    const meta = parseMetadata("chord-sample.pro", content);
    expect(meta.title).toBe("Hey Jude");
    expect(meta.artist).toBe("The Beatles");
    expect(meta.spotifyTrackId).toBe("0aym2LBJBk9DAYuHHutrIl");
  });

  it("falls back to filename Artist - Title convention", () => {
    const content = readFileSync(F("Artist Name - Song Title.pro"), "utf8");
    const meta = parseMetadata("Artist Name - Song Title.pro", content);
    expect(meta.title).toBe("Song Title");
    expect(meta.artist).toBe("Artist Name");
    expect(meta.spotifyTrackId).toBeUndefined();
  });

  it("falls back to filename as title when no artist available", () => {
    const meta = parseMetadata("mystery.pro", "no directives");
    expect(meta.title).toBe("mystery");
    expect(meta.artist).toBe("");
  });
});
```

- [ ] **Step 3: Run tests, confirm failure**

Run: `npm test -- --run library/parser`
Expected: module not found.

- [ ] **Step 4: Implement `lib/library/format.ts`**

```ts
export type Format = "chordpro" | "ascii-tab" | "guitar-pro";

export function detectFormat(filename: string, content: string): Format {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".gp") || lower.endsWith(".gpx") || lower.endsWith(".gp5")) return "guitar-pro";
  if (lower.endsWith(".pro") || lower.endsWith(".cho")) return "chordpro";
  // .txt or unknown: sniff for tab lines
  const tabRegex = /^\s*[eEBGDAE][\|].+$/m;
  return tabRegex.test(content) ? "ascii-tab" : "chordpro";
}
```

- [ ] **Step 5: Implement `lib/library/parser.ts`**

```ts
export type Metadata = {
  title: string;
  artist: string;
  spotifyTrackId?: string;
};

export function parseMetadata(filename: string, content: string): Metadata {
  const title = directive(content, "title") ?? directive(content, "t");
  const artist = directive(content, "artist") ?? directive(content, "a");
  const spotifyTrackId = directive(content, "spotify_track_id");

  if (title && artist) {
    return { title, artist, spotifyTrackId };
  }

  const base = filename.replace(/\.[^.]+$/, "").replaceAll("/", "-");
  const dashIdx = base.indexOf(" - ");
  if (dashIdx > 0) {
    return {
      artist: artist ?? base.slice(0, dashIdx).trim(),
      title: title ?? base.slice(dashIdx + 3).trim(),
      spotifyTrackId
    };
  }
  return {
    title: title ?? base,
    artist: artist ?? "",
    spotifyTrackId
  };
}

function directive(content: string, name: string): string | undefined {
  const re = new RegExp(`\\{\\s*${name}\\s*:\\s*([^}]+)\\}`, "i");
  const m = content.match(re);
  return m ? m[1].trim() : undefined;
}
```

- [ ] **Step 6: Run tests**

Run: `npm test -- --run library/parser`
Expected: seven tests pass.

- [ ] **Step 7: Commit**

```bash
git add lib/library/format.ts lib/library/parser.ts tests/lib/library/parser.test.ts tests/lib/library/fixtures/
git commit -m "feat(library): add format detection and metadata parser"
```

---

## Task 13: In-memory library index

**Files:**
- Create: `lib/library/index.ts`
- Create: `tests/lib/library/index.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/lib/library/index.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LibraryIndex } from "@/lib/library/index";

describe("LibraryIndex", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "chordplay-lib-"));
  });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("indexes files recursively", async () => {
    mkdirSync(join(dir, "beatles"), { recursive: true });
    writeFileSync(join(dir, "beatles", "hey-jude.pro"), "{title: Hey Jude}\n{artist: The Beatles}");
    writeFileSync(join(dir, "misc.txt"), "e|---0---0---\n");
    const idx = new LibraryIndex(dir);
    await idx.rescan();
    const all = idx.all();
    expect(all).toHaveLength(2);
    const hj = all.find(e => e.title === "Hey Jude")!;
    expect(hj.artist).toBe("The Beatles");
    expect(hj.format).toBe("chordpro");
    const tab = all.find(e => e.format === "ascii-tab")!;
    expect(tab).toBeDefined();
  });

  it("lookupByTrackId returns entry when directive present", async () => {
    writeFileSync(join(dir, "song.pro"), "{title: X}\n{artist: Y}\n{spotify_track_id: abc123}");
    const idx = new LibraryIndex(dir);
    await idx.rescan();
    const e = idx.lookupByTrackId("abc123");
    expect(e?.title).toBe("X");
  });

  it("lookupByKey returns entries for normalized key", async () => {
    writeFileSync(join(dir, "a.pro"), "{title: Hey Jude!}\n{artist: The Beatles}");
    const idx = new LibraryIndex(dir);
    await idx.rescan();
    const list = idx.lookupByKey("the beatles|hey jude");
    expect(list).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test, confirm failure**

Run: `npm test -- --run library/index`
Expected: module not found.

- [ ] **Step 3: Implement `lib/library/index.ts`**

```ts
import { readFile } from "node:fs/promises";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { parseMetadata, Metadata } from "./parser";
import { detectFormat, Format } from "./format";
import { normalizeKey } from "./normalize";

export type LibraryEntry = {
  id: string;            // relative path from root
  path: string;          // absolute path
  title: string;
  artist: string;
  format: Format;
  spotifyTrackId?: string;
  parseError?: boolean;
};

const SUPPORTED = /\.(pro|cho|txt|gp|gpx|gp5)$/i;

export class LibraryIndex {
  private byId = new Map<string, LibraryEntry>();
  private byTrackId = new Map<string, string>();
  private byKey = new Map<string, string[]>();

  constructor(private readonly root: string) {}

  async rescan(): Promise<void> {
    this.byId.clear();
    this.byTrackId.clear();
    this.byKey.clear();
    for (const path of walk(this.root)) {
      await this.addOrUpdate(path);
    }
  }

  async addOrUpdate(absPath: string): Promise<void> {
    if (!SUPPORTED.test(absPath)) return;
    const id = relative(this.root, absPath);
    try {
      let content = "";
      if (!absPath.match(/\.(gp|gpx|gp5)$/i)) {
        content = await readFile(absPath, "utf8");
      }
      const meta: Metadata = parseMetadata(id, content);
      const format = detectFormat(absPath, content);
      const entry: LibraryEntry = {
        id, path: absPath,
        title: meta.title, artist: meta.artist,
        format, spotifyTrackId: meta.spotifyTrackId
      };
      this.remove(id); // clear old indexes
      this.byId.set(id, entry);
      if (entry.spotifyTrackId) this.byTrackId.set(entry.spotifyTrackId, id);
      const key = normalizeKey(entry.artist, entry.title);
      const list = this.byKey.get(key) ?? [];
      list.push(id);
      this.byKey.set(key, list);
    } catch (err) {
      const entry: LibraryEntry = {
        id, path: absPath, title: id, artist: "",
        format: "chordpro", parseError: true
      };
      this.byId.set(id, entry);
    }
  }

  remove(id: string): void {
    const existing = this.byId.get(id);
    if (!existing) return;
    if (existing.spotifyTrackId) this.byTrackId.delete(existing.spotifyTrackId);
    const key = normalizeKey(existing.artist, existing.title);
    const list = this.byKey.get(key);
    if (list) {
      const filtered = list.filter(x => x !== id);
      if (filtered.length === 0) this.byKey.delete(key);
      else this.byKey.set(key, filtered);
    }
    this.byId.delete(id);
  }

  get(id: string): LibraryEntry | undefined { return this.byId.get(id); }
  all(): LibraryEntry[] { return [...this.byId.values()]; }
  lookupByTrackId(trackId: string): LibraryEntry | undefined {
    const id = this.byTrackId.get(trackId);
    return id ? this.byId.get(id) : undefined;
  }
  lookupByKey(key: string): LibraryEntry[] {
    return (this.byKey.get(key) ?? []).map(id => this.byId.get(id)!).filter(Boolean);
  }
  keys(): IterableIterator<string> { return this.byKey.keys(); }
}

function* walk(root: string): Generator<string> {
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries;
    try { entries = readdirSync(dir); } catch { continue; }
    for (const name of entries) {
      if (name.startsWith(".")) continue;
      const full = join(dir, name);
      try {
        const st = statSync(full);
        if (st.isDirectory()) stack.push(full);
        else if (st.isFile()) yield full;
      } catch { /* ignore */ }
    }
  }
}
```

Note: import `afterEach` from `vitest` in the test; Step 1 snippet uses it.

Correction to Step 1 test file imports:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
```

- [ ] **Step 4: Run tests**

Run: `npm test -- --run library/index`
Expected: three tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/library/index.ts tests/lib/library/index.test.ts
git commit -m "feat(library): add in-memory index with rescan and lookups"
```

---

## Task 14: Chokidar watcher integration

**Files:**
- Create: `lib/library/watcher.ts`
- Create: `tests/lib/library/watcher.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/lib/library/watcher.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LibraryIndex } from "@/lib/library/index";
import { startLibraryWatcher } from "@/lib/library/watcher";

function wait(ms: number) { return new Promise(r => setTimeout(r, ms)); }

describe("library watcher", () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "chordplay-watch-")); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("picks up file additions and removals", async () => {
    const idx = new LibraryIndex(dir);
    await idx.rescan();
    const stop = startLibraryWatcher(idx, dir);
    await wait(200);
    writeFileSync(join(dir, "a.pro"), "{title: A}\n{artist: B}");
    await wait(500);
    expect(idx.all().map(e => e.title)).toContain("A");
    unlinkSync(join(dir, "a.pro"));
    await wait(500);
    expect(idx.all().map(e => e.title)).not.toContain("A");
    await stop();
  });
});
```

- [ ] **Step 2: Run test, confirm failure**

Run: `npm test -- --run library/watcher`
Expected: module not found.

- [ ] **Step 3: Implement `lib/library/watcher.ts`**

```ts
import chokidar from "chokidar";
import { relative } from "node:path";
import type { LibraryIndex } from "./index";

export function startLibraryWatcher(index: LibraryIndex, root: string): () => Promise<void> {
  const watcher = chokidar.watch(root, {
    ignoreInitial: true,
    ignored: /(^|[\\/])\../,
    persistent: true
  });

  const upsert = (path: string) => { void index.addOrUpdate(path); };
  const remove = (path: string) => { index.remove(relative(root, path)); };

  watcher.on("add", upsert);
  watcher.on("change", upsert);
  watcher.on("unlink", remove);

  return () => watcher.close();
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- --run library/watcher`
Expected: single test passes. If the test is flaky on macOS due to FS event timing, increase `wait(500)` to `wait(1000)`.

- [ ] **Step 5: Commit**

```bash
git add lib/library/watcher.ts tests/lib/library/watcher.test.ts
git commit -m "feat(library): add chokidar watcher"
```

---

## Task 15: Library singleton bootstrap

**Files:**
- Create: `lib/library/singleton.ts`

- [ ] **Step 1: Implement the singleton**

```ts
import { getConfig } from "../config";
import { LibraryIndex } from "./index";
import { startLibraryWatcher } from "./watcher";

let instance: LibraryIndex | null = null;
let stopWatcher: (() => Promise<void>) | null = null;
let bootstrap: Promise<void> | null = null;

export function getLibrary(): LibraryIndex {
  if (!instance) {
    const cfg = getConfig();
    instance = new LibraryIndex(cfg.libraryPath);
    bootstrap = instance.rescan().then(() => {
      stopWatcher = startLibraryWatcher(instance!, cfg.libraryPath);
    });
  }
  return instance;
}

export async function libraryReady(): Promise<void> {
  getLibrary();
  if (bootstrap) await bootstrap;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/library/singleton.ts
git commit -m "feat(library): add singleton bootstrap with watcher"
```

---

## Task 16: Library matcher

**Files:**
- Create: `lib/library/matcher.ts`
- Create: `tests/lib/library/matcher.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/lib/library/matcher.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LibraryIndex } from "@/lib/library/index";
import { match } from "@/lib/library/matcher";

describe("matcher", () => {
  let dir: string;
  let idx: LibraryIndex;
  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "chordplay-match-"));
    writeFileSync(join(dir, "hey-jude.pro"),
      "{title: Hey Jude}\n{artist: The Beatles}\n{spotify_track_id: trk-hj}");
    writeFileSync(join(dir, "creep.pro"),
      "{title: Creep}\n{artist: Radiohead}");
    idx = new LibraryIndex(dir);
    await idx.rescan();
  });

  it("exact match on track id", () => {
    const r = match(idx, { trackId: "trk-hj", title: "Hey Jude (Remastered)", artists: ["The Beatles"] }, {});
    expect(r.match?.title).toBe("Hey Jude");
    expect(r.confidence).toBe("exact");
  });

  it("exact match on normalized key", () => {
    const r = match(idx, { trackId: "unknown", title: "Creep", artists: ["Radiohead"] }, {});
    expect(r.match?.title).toBe("Creep");
    expect(r.confidence).toBe("exact");
  });

  it("fuzzy match within threshold", () => {
    const r = match(idx, { trackId: "unknown", title: "Creeep", artists: ["Radiohead"] }, {});
    expect(r.match?.title).toBe("Creep");
    expect(r.confidence).toBe("fuzzy");
  });

  it("no match when confidence too low", () => {
    const r = match(idx, { trackId: "unknown", title: "xyzzy", artists: ["nobody"] }, {});
    expect(r.match).toBeNull();
  });

  it("prefs override wins over index", () => {
    const r = match(
      idx,
      { trackId: "trk-hj", title: "Hey Jude", artists: ["The Beatles"] },
      { trackOverrides: { "trk-hj": "creep.pro" } }
    );
    expect(r.match?.title).toBe("Creep");
    expect(r.confidence).toBe("exact");
  });
});
```

- [ ] **Step 2: Run test, confirm failure**

Run: `npm test -- --run library/matcher`
Expected: module not found.

- [ ] **Step 3: Implement `lib/library/matcher.ts`**

```ts
import { LibraryIndex, LibraryEntry } from "./index";
import { normalizeKey, levenshteinRatio } from "./normalize";

export type MatchInput = {
  trackId: string;
  title: string;
  artists: string[];
};

export type MatchPrefs = {
  trackOverrides?: Record<string, string>; // trackId -> library entry id
};

export type MatchResult = {
  match: LibraryEntry | null;
  confidence: "exact" | "fuzzy" | null;
};

const FUZZY_THRESHOLD = 0.85;

export function match(index: LibraryIndex, input: MatchInput, prefs: MatchPrefs): MatchResult {
  // 1. Prefs override
  const overrideId = prefs.trackOverrides?.[input.trackId];
  if (overrideId) {
    const e = index.get(overrideId);
    if (e) return { match: e, confidence: "exact" };
  }

  // 2. Exact on spotify track id directive
  const byId = index.lookupByTrackId(input.trackId);
  if (byId) return { match: byId, confidence: "exact" };

  // 3. Exact on normalized key
  const artist = input.artists.join(", ");
  const wantedKey = normalizeKey(artist, input.title);
  const byKey = index.lookupByKey(wantedKey);
  if (byKey.length > 0) return { match: byKey[0], confidence: "exact" };

  // 4. Fuzzy across all keys
  let best: { entry: LibraryEntry; ratio: number } | null = null;
  for (const key of index.keys()) {
    const r = levenshteinRatio(key, wantedKey);
    if (r >= FUZZY_THRESHOLD && (!best || r > best.ratio)) {
      const candidates = index.lookupByKey(key);
      if (candidates[0]) best = { entry: candidates[0], ratio: r };
    }
  }
  if (best) return { match: best.entry, confidence: "fuzzy" };
  return { match: null, confidence: null };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- --run library/matcher`
Expected: five tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/library/matcher.ts tests/lib/library/matcher.test.ts
git commit -m "feat(library): add matcher with exact/fuzzy/prefs precedence"
```

---

## Task 17: /api/library/match route

**Files:**
- Create: `app/api/library/match/route.ts`

- [ ] **Step 1: Implement the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { libraryReady, getLibrary } from "@/lib/library/singleton";
import { match } from "@/lib/library/matcher";
import { readPrefs } from "@/lib/prefs/store";
import { getConfig } from "@/lib/config";

export async function GET(req: NextRequest) {
  await libraryReady();
  const url = new URL(req.url);
  const trackId = url.searchParams.get("track_id");
  const title = url.searchParams.get("title") ?? "";
  const artist = url.searchParams.get("artist") ?? "";
  if (!trackId) return NextResponse.json({ error: "track_id required" }, { status: 400 });

  const cfg = getConfig();
  const prefs = await readPrefs(cfg.dataPath);
  const result = match(getLibrary(), { trackId, title, artists: [artist] }, {
    trackOverrides: prefs.trackOverrides
  });
  return NextResponse.json(result);
}
```

Note: `readPrefs` comes from Task 19. Until Task 19 lands, this route won't compile — keep this task and Task 19 adjacent in execution order.

- [ ] **Step 2: Commit (wait to typecheck until Task 19)**

```bash
git add app/api/library/match/route.ts
git commit -m "feat(library): add match api route"
```

---

## Task 18: Library editor (atomic write + path sanitization)

**Files:**
- Create: `lib/library/editor.ts`
- Create: `tests/lib/library/editor.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/lib/library/editor.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeEntry, createEntry, safePath } from "@/lib/library/editor";

describe("editor", () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "chordplay-edit-")); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("safePath rejects traversal", () => {
    expect(() => safePath(dir, "../etc/passwd")).toThrow();
    expect(() => safePath(dir, "/absolute/elsewhere.pro")).toThrow();
    expect(safePath(dir, "a/b.pro")).toBe(join(dir, "a/b.pro"));
  });

  it("writeEntry updates an existing file atomically", async () => {
    writeFileSync(join(dir, "a.pro"), "old");
    await writeEntry(dir, "a.pro", "new contents");
    expect(readFileSync(join(dir, "a.pro"), "utf8")).toBe("new contents");
  });

  it("createEntry writes a new chordpro file with directives", async () => {
    const id = await createEntry(dir, {
      title: "Test Song", artist: "Test Artist", format: "chordpro",
      content: "[C]hello", spotifyTrackId: "trk-123"
    });
    const text = readFileSync(join(dir, id), "utf8");
    expect(text).toContain("{title: Test Song}");
    expect(text).toContain("{artist: Test Artist}");
    expect(text).toContain("{spotify_track_id: trk-123}");
    expect(text).toContain("[C]hello");
  });
});
```

- [ ] **Step 2: Run test, confirm failure**

Run: `npm test -- --run library/editor`
Expected: module not found.

- [ ] **Step 3: Implement `lib/library/editor.ts`**

```ts
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { Format } from "./format";

export function safePath(root: string, id: string): string {
  if (isAbsolute(id)) throw new Error("absolute paths not allowed");
  const full = resolve(root, id);
  const rel = relative(root, full);
  if (rel.startsWith("..") || isAbsolute(rel)) throw new Error("path traversal rejected");
  return full;
}

export async function writeEntry(root: string, id: string, content: string): Promise<void> {
  const target = safePath(root, id);
  await mkdir(dirname(target), { recursive: true });
  const tmp = `${target}.tmp.${process.pid}`;
  await writeFile(tmp, content, "utf8");
  await rename(tmp, target);
}

export type CreateInput = {
  title: string;
  artist: string;
  format: Format;
  content: string;
  spotifyTrackId?: string;
  folder?: string; // subfolder under root; default "inbox"
};

export async function createEntry(root: string, input: CreateInput): Promise<string> {
  const folder = input.folder ?? "inbox";
  const ext = input.format === "guitar-pro" ? "gp" : input.format === "ascii-tab" ? "txt" : "pro";
  const safe = (s: string) => s.replace(/[^\p{L}\p{N}\s.-]/gu, "").trim().replace(/\s+/g, "_");
  const filename = `${safe(input.artist)}-${safe(input.title)}.${ext}`;
  const id = join(folder, filename);
  let body = "";
  if (input.format === "chordpro" || input.format === "ascii-tab") {
    body += `{title: ${input.title}}\n`;
    body += `{artist: ${input.artist}}\n`;
    if (input.spotifyTrackId) body += `{spotify_track_id: ${input.spotifyTrackId}}\n`;
    body += "\n" + input.content;
  } else {
    // binary format - take content as-is (client should send raw bytes via a separate endpoint).
    body = input.content;
  }
  await writeEntry(root, id, body);
  return id;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- --run library/editor`
Expected: four tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/library/editor.ts tests/lib/library/editor.test.ts
git commit -m "feat(library): add editor with atomic writes and path sanitization"
```

---

## Task 19: Prefs store + /api/prefs + /api/library CRUD

**Files:**
- Create: `lib/prefs/store.ts`
- Create: `tests/lib/prefs/store.test.ts`
- Create: `app/api/prefs/route.ts`
- Create: `app/api/library/route.ts`
- Create: `app/api/library/[id]/route.ts`

- [ ] **Step 1: Write prefs store test**

`tests/lib/prefs/store.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readPrefs, writePrefs } from "@/lib/prefs/store";

describe("prefs store", () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "chordplay-prefs-")); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("returns defaults when file absent", async () => {
    const p = await readPrefs(dir);
    expect(p.autoScroll).toBe(false);
    expect(p.songPreferences).toEqual({});
    expect(p.trackOverrides).toEqual({});
  });

  it("writes and reads prefs", async () => {
    await writePrefs(dir, { autoScroll: true, songPreferences: { "id1": "tab" }, trackOverrides: { "t1": "id1" } });
    const p = await readPrefs(dir);
    expect(p.autoScroll).toBe(true);
    expect(p.songPreferences).toEqual({ "id1": "tab" });
  });
});
```

- [ ] **Step 2: Run test, confirm failure**

Run: `npm test -- --run prefs/store`
Expected: module not found.

- [ ] **Step 3: Implement `lib/prefs/store.ts`**

```ts
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { join } from "node:path";

export type Prefs = {
  autoScroll: boolean;
  songPreferences: Record<string, "chords" | "tab">;
  trackOverrides: Record<string, string>;
};

const DEFAULT: Prefs = { autoScroll: false, songPreferences: {}, trackOverrides: {} };
const FILE = "prefs.json";

export async function readPrefs(dataDir: string): Promise<Prefs> {
  try {
    const raw = await readFile(join(dataDir, FILE), "utf8");
    const parsed = JSON.parse(raw);
    return { ...DEFAULT, ...parsed };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { ...DEFAULT };
    throw err;
  }
}

export async function writePrefs(dataDir: string, prefs: Prefs): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  const path = join(dataDir, FILE);
  const tmp = `${path}.tmp.${process.pid}`;
  await writeFile(tmp, JSON.stringify(prefs, null, 2), "utf8");
  await rename(tmp, path);
}
```

- [ ] **Step 4: Run prefs tests**

Run: `npm test -- --run prefs/store`
Expected: two tests pass.

- [ ] **Step 5: Implement `app/api/prefs/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { readPrefs, writePrefs, Prefs } from "@/lib/prefs/store";

export async function GET() {
  const cfg = getConfig();
  const p = await readPrefs(cfg.dataPath);
  return NextResponse.json(p);
}

export async function PUT(req: NextRequest) {
  const cfg = getConfig();
  const body = (await req.json()) as Partial<Prefs>;
  const current = await readPrefs(cfg.dataPath);
  const merged: Prefs = {
    autoScroll: body.autoScroll ?? current.autoScroll,
    songPreferences: body.songPreferences ?? current.songPreferences,
    trackOverrides: body.trackOverrides ?? current.trackOverrides
  };
  await writePrefs(cfg.dataPath, merged);
  return NextResponse.json(merged);
}
```

- [ ] **Step 6: Implement `app/api/library/route.ts` (POST create)**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { createEntry } from "@/lib/library/editor";
import { getLibrary, libraryReady } from "@/lib/library/singleton";
import type { Format } from "@/lib/library/format";

export async function POST(req: NextRequest) {
  await libraryReady();
  const body = (await req.json()) as {
    title: string;
    artist: string;
    format: Format;
    content: string;
    spotifyTrackId?: string;
    folder?: string;
  };
  if (!body.title || !body.format || body.content === undefined) {
    return NextResponse.json({ error: "title, format, content required" }, { status: 400 });
  }
  const cfg = getConfig();
  const id = await createEntry(cfg.libraryPath, body);
  // Watcher will pick up the new file, but force a rescan of this path so the response includes the entry:
  await getLibrary().addOrUpdate(`${cfg.libraryPath}/${id}`);
  return NextResponse.json({ id });
}
```

- [ ] **Step 7: Implement `app/api/library/[id]/route.ts` (GET + PUT)**

```ts
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { getConfig } from "@/lib/config";
import { writeEntry, safePath } from "@/lib/library/editor";
import { getLibrary, libraryReady } from "@/lib/library/singleton";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await libraryReady();
  const { id } = await params;
  const decoded = decodeURIComponent(id);
  const cfg = getConfig();
  const entry = getLibrary().get(decoded);
  if (!entry) return NextResponse.json({ error: "not found" }, { status: 404 });
  try {
    const full = safePath(cfg.libraryPath, decoded);
    const content = await readFile(full, "utf8");
    return NextResponse.json({ entry, content });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await libraryReady();
  const { id } = await params;
  const decoded = decodeURIComponent(id);
  const body = (await req.json()) as { content: string };
  if (typeof body.content !== "string") {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }
  const cfg = getConfig();
  try {
    await writeEntry(cfg.libraryPath, decoded, body.content);
    await getLibrary().addOrUpdate(safePath(cfg.libraryPath, decoded));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 8: Typecheck everything (match route from Task 17 should now compile)**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add lib/prefs/store.ts tests/lib/prefs/store.test.ts \
        app/api/prefs/route.ts app/api/library/route.ts app/api/library/[id]/route.ts
git commit -m "feat: add prefs store and library crud routes"
```

---

## Task 20: /api/health route

**Files:**
- Create: `app/api/health/route.ts`

- [ ] **Step 1: Implement**

```ts
import { NextResponse } from "next/server";
import { access } from "node:fs/promises";
import { getConfig } from "@/lib/config";
import { libraryReady } from "@/lib/library/singleton";

export async function GET() {
  try {
    const cfg = getConfig();
    await access(cfg.libraryPath);
    await access(cfg.dataPath);
    await libraryReady();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 503 });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/health/route.ts
git commit -m "feat: add health check route"
```

---

## Task 21: `useNowPlaying` hook

**Files:**
- Create: `hooks/useNowPlaying.ts`

- [ ] **Step 1: Implement**

```ts
"use client";

import { useEffect, useRef, useState } from "react";
import type { NowPlaying } from "@/lib/spotify/now-playing-cache";

type State = {
  data: NowPlaying;
  loading: boolean;
  error: string | null;
};

export function useNowPlaying(intervalMs = 2000) {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null });
  const visibleRef = useRef(true);

  useEffect(() => {
    const onVis = () => { visibleRef.current = document.visibilityState === "visible"; };
    document.addEventListener("visibilitychange", onVis);
    let cancelled = false;
    let backoff = intervalMs;

    const tick = async () => {
      if (!visibleRef.current) return;
      try {
        const res = await fetch("/api/now-playing");
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as NowPlaying;
        if (cancelled) return;
        setState({ data: json, loading: false, error: null });
        backoff = intervalMs;
      } catch (err) {
        if (cancelled) return;
        setState(s => ({ ...s, error: (err as Error).message, loading: false }));
        backoff = Math.min(backoff * 2, 30_000);
      }
    };
    tick();
    const handle = window.setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [intervalMs]);

  return state;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add hooks/useNowPlaying.ts
git commit -m "feat(client): add useNowPlaying polling hook"
```

---

## Task 22: ChordProView component

**Files:**
- Create: `components/ChordProView.tsx`

- [ ] **Step 1: Implement**

```tsx
"use client";

import { useMemo } from "react";
import { ChordProParser, HtmlDivFormatter } from "chordsheetjs";

export function ChordProView({ source }: { source: string }) {
  const html = useMemo(() => {
    try {
      const song = new ChordProParser().parse(source);
      return new HtmlDivFormatter().format(song);
    } catch (err) {
      return `<pre class="text-red-400">Parse error: ${(err as Error).message}</pre><pre>${escape(source)}</pre>`;
    }
  }, [source]);
  return (
    <div
      className="chordpro prose prose-invert max-w-none font-mono"
      // Library author = you; content is trusted. See spec security notes.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function escape(s: string): string {
  return s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If `chordsheetjs` types need a shim, add a `.d.ts` with `declare module "chordsheetjs";` in `types/chordsheetjs.d.ts` and reference in `tsconfig.json` `include`.

- [ ] **Step 3: Commit**

```bash
git add components/ChordProView.tsx
git commit -m "feat(client): add ChordProView with chordsheetjs"
```

---

## Task 23: TabView component (ASCII + alphaTab)

**Files:**
- Create: `components/TabView.tsx`

- [ ] **Step 1: Implement**

```tsx
"use client";

import { useEffect, useRef } from "react";

type AsciiProps = { kind: "ascii"; text: string };
type GpProps    = { kind: "guitar-pro"; src: string };
type Props = AsciiProps | GpProps;

export function TabView(props: Props) {
  if (props.kind === "ascii") {
    return <pre className="font-mono whitespace-pre overflow-x-auto p-4 bg-neutral-900 rounded">{props.text}</pre>;
  }
  return <AlphaTabView src={props.src} />;
}

function AlphaTabView({ src }: { src: string }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    let api: unknown = null;
    let cancelled = false;
    (async () => {
      const { AlphaTabApi, Settings } = await import("@coderline/alphatab");
      if (cancelled || !mountRef.current) return;
      const settings = new Settings();
      settings.core.file = src; // URL to .gp/.gpx/.gp5
      api = new AlphaTabApi(mountRef.current, settings);
    })();
    return () => {
      cancelled = true;
      if (api && typeof (api as { destroy?: () => void }).destroy === "function") {
        (api as { destroy: () => void }).destroy();
      }
    };
  }, [src]);
  return <div ref={mountRef} className="alphatab-container" />;
}
```

Note: alphaTab ships heavy assets. The dynamic `import()` keeps it client-only and out of the server bundle.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. Add a `.d.ts` shim if `@coderline/alphatab` types are incomplete.

- [ ] **Step 3: Commit**

```bash
git add components/TabView.tsx
git commit -m "feat(client): add TabView for ascii and guitar-pro tabs"
```

---

## Task 24: AutoScroller component

**Files:**
- Create: `components/AutoScroller.tsx`

- [ ] **Step 1: Implement**

```tsx
"use client";

import { useEffect, useRef } from "react";

type Props = {
  enabled: boolean;
  progressMs: number;
  durationMs: number;
  speedMultiplier?: number; // user nudge, default 1.0
  targetRef: React.RefObject<HTMLElement>;
};

export function AutoScroller({ enabled, progressMs, durationMs, speedMultiplier = 1, targetRef }: Props) {
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<{ progressMs: number; at: number } | null>(null);

  useEffect(() => {
    if (!enabled || !targetRef.current || durationMs <= 0) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    startRef.current = { progressMs, at: performance.now() };
    const el = targetRef.current;

    const step = () => {
      if (!startRef.current || !el) return;
      const now = performance.now();
      const elapsed = now - startRef.current.at;
      const virtualProgress = startRef.current.progressMs + elapsed * speedMultiplier;
      const pct = Math.max(0, Math.min(1, virtualProgress / durationMs));
      const max = el.scrollHeight - el.clientHeight;
      el.scrollTop = pct * max;
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, progressMs, durationMs, speedMultiplier, targetRef]);

  return null;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/AutoScroller.tsx
git commit -m "feat(client): add AutoScroller for playback-synced scrolling"
```

---

## Task 25: Supporting components (NowPlayingHeader, ConnectSpotify)

**Files:**
- Create: `components/NowPlayingHeader.tsx`
- Create: `components/ConnectSpotify.tsx`

- [ ] **Step 1: Implement `components/NowPlayingHeader.tsx`**

```tsx
"use client";

import type { NowPlaying } from "@/lib/spotify/now-playing-cache";

export function NowPlayingHeader({ data }: { data: NowPlaying }) {
  if (!data) return <div className="p-4 text-neutral-400">Waiting for playback…</div>;
  return (
    <div className="flex items-center gap-4 p-4 border-b border-neutral-800">
      {data.albumArt && (
        <img src={data.albumArt} alt="" className="w-14 h-14 rounded" />
      )}
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">{data.title}</div>
        <div className="text-sm text-neutral-400 truncate">{data.artists.join(", ")}</div>
      </div>
      <div className="text-sm text-neutral-500">
        {formatMs(data.progressMs)} / {formatMs(data.durationMs)}
      </div>
    </div>
  );
}

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
```

- [ ] **Step 2: Implement `components/ConnectSpotify.tsx`**

```tsx
export function ConnectSpotify() {
  return (
    <div className="p-8 text-center">
      <p className="mb-4 text-neutral-300">Connect your Spotify account to get started.</p>
      <a href="/api/auth/login" className="inline-block px-4 py-2 rounded bg-green-600 hover:bg-green-500 font-semibold">
        Connect Spotify
      </a>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/NowPlayingHeader.tsx components/ConnectSpotify.tsx
git commit -m "feat(client): add header and connect components"
```

---

## Task 26: QuickAddForm & Editor components

**Files:**
- Create: `components/QuickAddForm.tsx`
- Create: `components/Editor.tsx`

- [ ] **Step 1: Implement `components/QuickAddForm.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { NowPlaying } from "@/lib/spotify/now-playing-cache";

export function QuickAddForm({ track, onCreated }: { track: NonNullable<NowPlaying>; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState(track.title);
  const [artist, setArtist] = useState(track.artists.join(", "));
  const [format, setFormat] = useState<"chordpro" | "ascii-tab">("chordpro");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, artist, format, content, spotifyTrackId: track.trackId })
      });
      if (!res.ok) throw new Error(await res.text());
      const { id } = await res.json();
      onCreated(id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="p-4 flex flex-col gap-3 max-w-2xl">
      <p className="text-neutral-300">No sheet in the library for this track. Add one:</p>
      <label className="flex flex-col text-sm">Title
        <input className="bg-neutral-900 p-2 rounded" value={title} onChange={e => setTitle(e.target.value)} />
      </label>
      <label className="flex flex-col text-sm">Artist
        <input className="bg-neutral-900 p-2 rounded" value={artist} onChange={e => setArtist(e.target.value)} />
      </label>
      <label className="flex flex-col text-sm">Format
        <select className="bg-neutral-900 p-2 rounded" value={format} onChange={e => setFormat(e.target.value as "chordpro" | "ascii-tab")}>
          <option value="chordpro">ChordPro</option>
          <option value="ascii-tab">ASCII tab</option>
        </select>
      </label>
      <label className="flex flex-col text-sm">Content
        <textarea
          className="bg-neutral-900 p-2 rounded font-mono min-h-64"
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={format === "chordpro" ? "[C]Hey [G]Jude..." : "e|---0---3---5---"}
        />
      </label>
      {error && <div className="text-red-400 text-sm">{error}</div>}
      <button disabled={saving} className="px-4 py-2 rounded bg-green-600 hover:bg-green-500 disabled:opacity-50">
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Implement `components/Editor.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";

export function Editor({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: () => void }) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/library/${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error(await res.text());
        const { content: c } = await res.json();
        setContent(c);
      } catch (err) { setError((err as Error).message); }
      finally { setLoading(false); }
    })();
  }, [id]);

  async function save() {
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/library/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
      });
      if (!res.ok) throw new Error(await res.text());
      onSaved();
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="p-4 text-neutral-400">Loading…</div>;
  return (
    <div className="p-4 flex flex-col gap-3">
      <textarea
        className="bg-neutral-900 p-2 rounded font-mono min-h-96"
        value={content}
        onChange={e => setContent(e.target.value)}
      />
      {error && <div className="text-red-400 text-sm">{error}</div>}
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="px-4 py-2 rounded bg-green-600 hover:bg-green-500 disabled:opacity-50">
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={onClose} className="px-4 py-2 rounded bg-neutral-800 hover:bg-neutral-700">Cancel</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/QuickAddForm.tsx components/Editor.tsx
git commit -m "feat(client): add quick-add and editor components"
```

---

## Task 27: Main page orchestration

**Files:**
- Modify: `app/page.tsx` (full rewrite)

- [ ] **Step 1: Rewrite `app/page.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useNowPlaying } from "@/hooks/useNowPlaying";
import { NowPlayingHeader } from "@/components/NowPlayingHeader";
import { ConnectSpotify } from "@/components/ConnectSpotify";
import { ChordProView } from "@/components/ChordProView";
import { TabView } from "@/components/TabView";
import { AutoScroller } from "@/components/AutoScroller";
import { QuickAddForm } from "@/components/QuickAddForm";
import { Editor } from "@/components/Editor";
import type { LibraryEntry } from "@/lib/library/index";
import type { Prefs } from "@/lib/prefs/store";

type MatchResponse = { match: LibraryEntry | null; confidence: "exact" | "fuzzy" | null };

export default function HomePage() {
  const np = useNowPlaying();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [matchResp, setMatchResp] = useState<MatchResponse | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [editing, setEditing] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Load prefs once
  useEffect(() => { fetch("/api/prefs").then(r => r.json()).then(setPrefs); }, []);

  // Detect connection: 502 from /api/now-playing with "not authenticated" body? We use a simpler rule:
  // if we receive a null payload AND a recent error referenced not-authenticated, show connect.
  // Simplification: probe /api/now-playing once on mount; if we get a 502 with "not authenticated" text show connect.
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/now-playing");
      if (res.status === 502) {
        const body = await res.json().catch(() => ({}));
        if (String(body.error).includes("not authenticated")) { setConnected(false); return; }
      }
      setConnected(true);
    })();
  }, []);

  // On track change, fetch match
  const trackId = np.data?.trackId;
  useEffect(() => {
    if (!trackId || !np.data) { setMatchResp(null); setContent(null); return; }
    (async () => {
      const url = new URL("/api/library/match", window.location.origin);
      url.searchParams.set("track_id", trackId);
      url.searchParams.set("title", np.data!.title);
      url.searchParams.set("artist", np.data!.artists.join(", "));
      const res = await fetch(url);
      if (!res.ok) return;
      const data = (await res.json()) as MatchResponse;
      setMatchResp(data);
      if (data.match) {
        const r = await fetch(`/api/library/${encodeURIComponent(data.match.id)}`);
        if (r.ok) {
          const { content: c } = await r.json();
          setContent(c);
        }
      } else {
        setContent(null);
      }
    })();
  }, [trackId, np.data]);

  async function toggleAutoScroll() {
    if (!prefs) return;
    const next = { ...prefs, autoScroll: !prefs.autoScroll };
    setPrefs(next);
    await fetch("/api/prefs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
  }

  if (connected === false) return <ConnectSpotify />;
  if (connected === null) return <div className="p-8 text-neutral-400">Loading…</div>;

  return (
    <div className="flex flex-col h-screen">
      <NowPlayingHeader data={np.data} />
      <div className="p-2 flex items-center gap-3 border-b border-neutral-800 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={prefs?.autoScroll ?? false} onChange={toggleAutoScroll} />
          Auto-scroll
        </label>
        {matchResp?.match && (
          <>
            <span className="text-neutral-500">
              {matchResp.confidence === "fuzzy" && "(fuzzy match)"}
            </span>
            <button onClick={() => setEditing(true)} className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700">
              Edit
            </button>
          </>
        )}
        <form action="/api/auth/logout" method="post" className="ml-auto">
          <button className="text-neutral-500 hover:text-neutral-300" type="submit">Logout</button>
        </form>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-auto">
        {editing && matchResp?.match ? (
          <Editor id={matchResp.match.id} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />
        ) : matchResp?.match && content !== null ? (
          renderEntry(matchResp.match, content)
        ) : np.data ? (
          <QuickAddForm track={np.data} onCreated={() => { /* next poll refetches */ }} />
        ) : (
          <div className="p-4 text-neutral-400">Waiting for Spotify…</div>
        )}
      </div>
      {np.data && prefs && (
        <AutoScroller
          enabled={prefs.autoScroll && !editing}
          progressMs={np.data.progressMs}
          durationMs={np.data.durationMs}
          targetRef={scrollRef as React.RefObject<HTMLElement>}
        />
      )}
    </div>
  );
}

function renderEntry(entry: LibraryEntry, content: string) {
  if (entry.format === "chordpro") return <ChordProView source={content} />;
  if (entry.format === "ascii-tab") return <TabView kind="ascii" text={content} />;
  return <TabView kind="guitar-pro" src={`/api/library/raw/${encodeURIComponent(entry.id)}`} />;
}
```

Note: the Guitar Pro render references a `/api/library/raw/:id` route that serves the raw file bytes. This is not included in v1 scope if you're shipping chord + ASCII tab only. If you add `.gp` files to your library, add a raw-bytes route in a follow-up task — flagged in the spec's expansion hooks.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors, `.next/standalone` builds.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat(client): wire main page with now-playing, match, edit, auto-scroll"
```

---

## Task 28: Dockerfile

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

- [ ] **Step 1: Create `.dockerignore`**

```
node_modules
.next
.git
tests
docs
*.md
coverage
```

- [ ] **Step 2: Create `Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["node", "server.js"]
```

- [ ] **Step 3: Build image locally to verify**

Run:
```bash
docker build -t chordplay:dev .
```
Expected: image builds without errors.

- [ ] **Step 4: Create `public/` directory with a placeholder (required by Dockerfile COPY)**

Run:
```bash
mkdir -p public && touch public/.gitkeep
```

- [ ] **Step 5: Commit**

```bash
git add Dockerfile .dockerignore public/.gitkeep
git commit -m "chore: add Dockerfile and .dockerignore"
```

---

## Task 29: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README"
```

---

## Out-of-scope for this plan (separate effort)

The Ansible role `chords` in the `homelab-infra` repo is not in this plan. It's its own piece of work that depends on a built Docker image being available. Open a separate spec/plan when ready, following the pattern of `homelab-infra/ansible/roles/actual/` or `mealie/`.

---

## Execution notes

- **Task order matters** for Tasks 7–9 and 17/19: some routes reference modules introduced in a later task. The `git commit` at the end of each task still works because TypeScript compile happens in the typecheck step; typecheck only has to pass at the end of the dependent task. If you want green-at-every-step, reorder so the lib module lands before its consumer.
- **Fixture files** in `tests/lib/library/fixtures/` are committed under the test dir; do not place them under `LIBRARY_PATH`.
- **Manual smoke test** after Task 29:
  1. Register a Spotify app, set redirect URI to `http://localhost:3000/api/auth/callback`
  2. Create `.env.local`, `LIBRARY_PATH=./dev-library`, `DATA_PATH=./dev-data`, fill other vars
  3. Drop one `.pro` file with a `spotify_track_id` directive into `./dev-library`
  4. `npm run dev`, connect Spotify, start playing the song in your account — sheet should appear.
  5. Toggle auto-scroll, verify scroll tracks progress.
  6. Edit the sheet, save, verify file on disk updated.

---

## Self-review checklist (completed)

**Spec coverage:**
- OAuth PKCE + refresh + logout — Tasks 3, 4, 5, 6, 7, 8, 9 ✓
- Now-playing cache + route — Task 10 ✓
- Library parsing, format detection, in-memory index, watcher — Tasks 11–15 ✓
- Matcher with exact/fuzzy/override precedence — Task 16 ✓
- Match + edit + create API routes — Tasks 17, 18, 19 ✓
- Prefs store + route — Task 19 ✓
- Health route — Task 20 ✓
- Client polling, rendering, auto-scroll, quick-add, editor — Tasks 21–27 ✓
- Dockerfile + README — Tasks 28, 29 ✓
- All v1 error-handling conditions are either implemented in code or surfaced via banner UI as described in the spec.

**Placeholders:** none. Every "implementation will come later" reference is to an adjacent task with its own code block.

**Type consistency:**
- `NowPlaying`, `LibraryEntry`, `Prefs`, `MatchResult`, `Format` are defined once and imported by consumers with consistent shapes.
- `match(index, input, prefs)` signature matches between `lib/library/matcher.ts` and `app/api/library/match/route.ts`.
- `readPrefs` / `writePrefs` signatures match between `lib/prefs/store.ts` and the route handlers.
- `getAccessToken(cfg)` signature matches across `lib/auth/spotify.ts`, `app/api/now-playing/route.ts`, and test invocations.

**Known gaps (noted, not fixed):**
- Connection detection on the main page uses a string-match on the error message from `/api/now-playing`. A cleaner approach would be a dedicated `/api/auth/status` endpoint. Acceptable for v1 given single-user and small surface. Add `/api/auth/status` in a follow-up if it becomes annoying.
- Guitar Pro rendering references a `/api/library/raw/:id` route not included in v1. Only relevant if you add `.gp` files before that follow-up lands.
