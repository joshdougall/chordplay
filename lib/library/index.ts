import { readFile } from "node:fs/promises";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { parseMetadata, Metadata } from "./parser";
import { detectFormat, Format } from "./format";
import { normalizeKey } from "./normalize";

export type LibraryEntry = {
  id: string;
  path: string;
  title: string;
  artist: string;
  format: Format;
  spotifyTrackId?: string;
  parseError?: boolean;
  songKey: string;
  versionName?: string;
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
      const songKey = normalizeKey(meta.artist, meta.title);
      const entry: LibraryEntry = {
        id, path: absPath,
        title: meta.title, artist: meta.artist,
        format, spotifyTrackId: meta.spotifyTrackId,
        songKey,
        versionName: meta.versionName,
      };
      this.remove(id);
      this.byId.set(id, entry);
      if (entry.spotifyTrackId) this.byTrackId.set(entry.spotifyTrackId, id);
      const key = normalizeKey(entry.artist, entry.title);
      const list = this.byKey.get(key) ?? [];
      list.push(id);
      this.byKey.set(key, list);
    } catch (err) {
      const entry: LibraryEntry = {
        id, path: absPath, title: id, artist: "",
        format: "chordpro", parseError: true,
        songKey: normalizeKey("", id),
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
  lookupAllByKey(key: string): LibraryEntry[] {
    return this.lookupByKey(key);
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
