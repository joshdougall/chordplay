import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
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

export async function deleteEntry(root: string, id: string): Promise<void> {
  const target = safePath(root, id);
  await unlink(target);
}

export type CreateInput = {
  title: string;
  artist: string;
  format: Format;
  content: string;
  spotifyTrackId?: string;
  folder?: string;
};

export async function setVersionName(root: string, id: string, versionName: string): Promise<void> {
  const full = safePath(root, id);
  const current = await readFile(full, "utf8");
  const versionRegex = /\{\s*version\s*:\s*[^}]+\}/i;
  let updated: string;
  if (versionRegex.test(current)) {
    updated = current.replace(versionRegex, `{version: ${versionName}}`);
  } else {
    const artistMatch = current.match(/\{\s*artist\s*:[^}]+\}\s*\n?/i);
    if (artistMatch) {
      const idx = (artistMatch.index ?? 0) + artistMatch[0].length;
      updated = current.slice(0, idx) + `{version: ${versionName}}\n` + current.slice(idx);
    } else {
      updated = `{version: ${versionName}}\n` + current;
    }
  }
  await writeEntry(root, id, updated);
}

export async function setSpotifyTrackId(root: string, id: string, trackId: string): Promise<void> {
  const full = safePath(root, id);
  const current = await readFile(full, "utf8");
  const directiveRegex = /\{\s*spotify_track_id\s*:\s*[^}]+\}/i;
  let updated: string;
  if (directiveRegex.test(current)) {
    updated = current.replace(directiveRegex, `{spotify_track_id: ${trackId}}`);
  } else {
    const artistMatch = current.match(/\{\s*artist\s*:[^}]+\}\s*\n?/i);
    if (artistMatch) {
      const idx = (artistMatch.index ?? 0) + artistMatch[0].length;
      updated = current.slice(0, idx) + `{spotify_track_id: ${trackId}}\n` + current.slice(idx);
    } else {
      updated = `{spotify_track_id: ${trackId}}\n` + current;
    }
  }
  await writeEntry(root, id, updated);
}

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
    body = input.content;
  }
  await writeEntry(root, id, body);
  return id;
}
