import { describe, it, expect, vi, beforeEach } from "vitest";
import { findChords, _resetCacheForTest } from "@/lib/external/chords";
import type { ChordProvider, ExternalChords } from "@/lib/external/provider";

// ---- Helpers ----

function makeProvider(
  id: string,
  result: ExternalChords | null,
  fetchFn?: (artist: string, title: string) => Promise<ExternalChords | null>
): ChordProvider & { fetchMock: ReturnType<typeof vi.fn> } {
  const fetchMock = vi.fn(fetchFn ?? (() => Promise.resolve(result)));
  return { id, name: id, fetch: fetchMock, fetchMock };
}

function makeResult(source: string): ExternalChords {
  return {
    source,
    sourceName: source,
    sourceUrl: `https://example.com/${source}`,
    content: `{title: Test}\n{artist: Artist}\n\n[C]Test content`,
    title: "Test Song",
    artist: "Test Artist",
  };
}

// Reset the module-level cache between tests.
beforeEach(() => {
  _resetCacheForTest();
});

// ---- Tests ----

describe("findChords — provider selection", () => {
  it("returns the first successful result and does not call remaining providers", async () => {
    const p1 = makeProvider("provider-a", makeResult("provider-a"));
    const p2 = makeProvider("provider-b", makeResult("provider-b"));

    const result = await findChords("Artist", "Song", [p1, p2]);

    expect(result).not.toBeNull();
    expect(result!.source).toBe("provider-a");
    expect(p1.fetchMock).toHaveBeenCalledOnce();
    expect(p2.fetchMock).not.toHaveBeenCalled();
  });

  it("falls through to the second provider when the first returns null", async () => {
    const p1 = makeProvider("provider-a", null);
    const p2 = makeProvider("provider-b", makeResult("provider-b"));

    const result = await findChords("Artist", "Song", [p1, p2]);

    expect(result).not.toBeNull();
    expect(result!.source).toBe("provider-b");
    expect(p1.fetchMock).toHaveBeenCalledOnce();
    expect(p2.fetchMock).toHaveBeenCalledOnce();
  });

  it("returns null when all providers return null", async () => {
    const p1 = makeProvider("provider-a", null);
    const p2 = makeProvider("provider-b", null);

    const result = await findChords("Artist", "Song", [p1, p2]);

    expect(result).toBeNull();
  });

  it("returns null when all providers throw", async () => {
    const p1 = makeProvider("provider-a", null, () => { throw new Error("net fail"); });
    const p2 = makeProvider("provider-b", null, () => { throw new Error("net fail"); });

    const result = await findChords("Artist", "Song", [p1, p2]);

    expect(result).toBeNull();
  });

  it("continues to next provider when a provider throws", async () => {
    const p1 = makeProvider("provider-a", null, () => { throw new Error("timeout"); });
    const p2 = makeProvider("provider-b", makeResult("provider-b"));

    const result = await findChords("Artist", "Song", [p1, p2]);

    expect(result!.source).toBe("provider-b");
  });

  it("returns null when provider list is empty", async () => {
    const result = await findChords("Artist", "Song", []);
    expect(result).toBeNull();
  });
});

describe("findChords — caching", () => {
  it("does not call the provider again for the same query after a hit", async () => {
    const p1 = makeProvider("provider-a", makeResult("provider-a"));

    await findChords("Artist", "Song", [p1]);
    await findChords("Artist", "Song", [p1]);

    expect(p1.fetchMock).toHaveBeenCalledOnce();
  });

  it("does not call a provider again for the same query after a miss", async () => {
    const p1 = makeProvider("provider-a", null);
    const p2 = makeProvider("provider-b", null);

    await findChords("Artist", "Song", [p1, p2]);
    await findChords("Artist", "Song", [p1, p2]);

    expect(p1.fetchMock).toHaveBeenCalledOnce();
    expect(p2.fetchMock).toHaveBeenCalledOnce();
  });

  it("caches per provider, so a hit on provider-b is returned on second call", async () => {
    const p1 = makeProvider("provider-a", null);
    const p2 = makeProvider("provider-b", makeResult("provider-b"));

    const first = await findChords("Artist", "Song", [p1, p2]);
    const second = await findChords("Artist", "Song", [p1, p2]);

    expect(first!.source).toBe("provider-b");
    expect(second!.source).toBe("provider-b");
    // provider-b fetch is called once; provider-a null is cached so called once too
    expect(p1.fetchMock).toHaveBeenCalledOnce();
    expect(p2.fetchMock).toHaveBeenCalledOnce();
  });

  it("normalises artist/title for cache keys (case and whitespace)", async () => {
    const p1 = makeProvider("provider-a", makeResult("provider-a"));

    await findChords("  The Beatles  ", "Hey Jude", [p1]);
    await findChords("the beatles", "hey jude", [p1]);

    expect(p1.fetchMock).toHaveBeenCalledOnce();
  });

  it("treats different titles as different cache entries", async () => {
    const p1 = makeProvider("provider-a", makeResult("provider-a"));

    await findChords("Artist", "Song One", [p1]);
    await findChords("Artist", "Song Two", [p1]);

    expect(p1.fetchMock).toHaveBeenCalledTimes(2);
  });

  it("_resetCacheForTest clears cached misses so providers are retried", async () => {
    const p1 = makeProvider("provider-a", null);

    await findChords("Artist", "Song", [p1]);
    expect(p1.fetchMock).toHaveBeenCalledOnce();

    _resetCacheForTest();
    await findChords("Artist", "Song", [p1]);
    expect(p1.fetchMock).toHaveBeenCalledTimes(2);
  });
});
