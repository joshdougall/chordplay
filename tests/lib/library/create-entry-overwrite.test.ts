import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEntry, EntryExistsError } from "@/lib/library/editor";

let root: string;
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), "chordplay-create-")); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

const base = { title: "Wagon Wheel", artist: "Darius Rucker", format: "chordpro" as const };

describe("createEntry overwrite protection", () => {
  it("creates the entry the first time", async () => {
    const id = await createEntry(root, { ...base, content: "[C]first" });
    expect(id).toBe("inbox/Darius_Rucker-Wagon_Wheel.pro");
  });

  it("refuses to clobber an existing sheet, and leaves it untouched", async () => {
    await createEntry(root, { ...base, content: "[C]MY CAREFULLY EDITED VERSION" });
    await expect(
      createEntry(root, { ...base, content: "[C]freshly fetched junk" })
    ).rejects.toBeInstanceOf(EntryExistsError);

    const onDisk = await readFile(join(root, "inbox/Darius_Rucker-Wagon_Wheel.pro"), "utf8");
    expect(onDisk).toContain("MY CAREFULLY EDITED VERSION");
    expect(onDisk).not.toContain("freshly fetched junk");
  });

  it("names the colliding id on the error so the caller can offer a choice", async () => {
    await createEntry(root, { ...base, content: "[C]first" });
    await expect(createEntry(root, { ...base, content: "[C]second" }))
      .rejects.toMatchObject({ id: "inbox/Darius_Rucker-Wagon_Wheel.pro" });
  });

  it("overwrites only when explicitly asked", async () => {
    await createEntry(root, { ...base, content: "[C]first" });
    const id = await createEntry(root, { ...base, content: "[C]second", overwrite: true });
    expect(await readFile(join(root, id), "utf8")).toContain("second");
  });

  it("a different song is unaffected", async () => {
    await createEntry(root, { ...base, content: "[C]first" });
    const id = await createEntry(root, { ...base, title: "Alright", content: "[G]other" });
    expect(id).toBe("inbox/Darius_Rucker-Alright.pro");
  });
});
