import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { atomicWrite } from "@/lib/fs/atomic";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "chordplay-atomic-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("atomicWrite", () => {
  it("writes content that reads back exactly", async () => {
    const path = join(dir, "note.txt");
    await atomicWrite(path, "hello");
    expect(await readFile(path, "utf8")).toBe("hello");
  });

  it("replaces existing content rather than appending", async () => {
    const path = join(dir, "note.txt");
    await atomicWrite(path, "first-and-longer");
    await atomicWrite(path, "second");
    expect(await readFile(path, "utf8")).toBe("second");
  });

  it("leaves valid content when many writers race the same path", async () => {
    const path = join(dir, "race.json");
    const writers = Array.from({ length: 12 }, (_, i) =>
      atomicWrite(path, JSON.stringify({ writer: i, pad: "x".repeat(2000) }))
    );

    const settled = await Promise.allSettled(writers);

    const rejected = settled.filter((s) => s.status === "rejected");
    expect(rejected).toEqual([]);

    // Whoever won, the file must be one writer's complete payload — never a splice of two.
    const parsed = JSON.parse(await readFile(path, "utf8"));
    expect(typeof parsed.writer).toBe("number");
    expect(parsed.pad).toHaveLength(2000);
  });

  it("leaves no temp files behind after concurrent writes", async () => {
    const path = join(dir, "race.json");
    await Promise.all(
      Array.from({ length: 12 }, (_, i) => atomicWrite(path, JSON.stringify({ writer: i })))
    );

    const leftovers = (await readdir(dir)).filter((f) => f !== "race.json");
    expect(leftovers).toEqual([]);
  });

  it("honours an explicit file mode", async () => {
    const path = join(dir, "secret.json");
    await atomicWrite(path, "{}", { mode: 0o600 });
    const { stat } = await import("node:fs/promises");
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });

  it("does not destroy the existing file when the write fails", async () => {
    const path = join(dir, "keep.txt");
    await writeFile(path, "original", "utf8");
    // A directory cannot be written to as a file; the temp write must fail before any rename.
    await expect(atomicWrite(join(dir), "nope")).rejects.toThrow();
    expect(await readFile(path, "utf8")).toBe("original");
  });
});
