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
  folder?: string;
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
    body = input.content;
  }
  await writeEntry(root, id, body);
  return id;
}
