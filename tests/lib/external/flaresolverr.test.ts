import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// flaresolverrFetch is a thin fetch wrapper; we test the response-shape
// parsing and env-guard behaviour without hitting a real endpoint.

describe("flaresolverrFetch", () => {
  const ENDPOINT = "http://flaresolverr:8191";

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.FLARESOLVERR_URL;
  });

  it("returns null when FLARESOLVERR_URL is not set", async () => {
    delete process.env.FLARESOLVERR_URL;
    const { flaresolverrFetch } = await import("@/lib/external/flaresolverr");
    const result = await flaresolverrFetch("https://example.com");
    expect(result).toBeNull();
  });

  it("returns HTML on a successful ok response", async () => {
    process.env.FLARESOLVERR_URL = ENDPOINT;
    const html = "<html><body>test</body></html>";
    const mockResponse = {
      status: "ok",
      solution: {
        url: "https://example.com",
        status: 200,
        response: html,
        userAgent: "Mozilla/5.0",
        cookies: [],
        headers: {},
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })
    );

    const { flaresolverrFetch } = await import("@/lib/external/flaresolverr");
    const result = await flaresolverrFetch("https://example.com");
    expect(result).toBe(html);
  });

  it("returns null when response status is not ok", async () => {
    process.env.FLARESOLVERR_URL = ENDPOINT;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      })
    );

    const { flaresolverrFetch } = await import("@/lib/external/flaresolverr");
    const result = await flaresolverrFetch("https://example.com");
    expect(result).toBeNull();
  });

  it("returns null when flaresolverr reports error status", async () => {
    process.env.FLARESOLVERR_URL = ENDPOINT;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "error", message: "Challenge failed" }),
      })
    );

    const { flaresolverrFetch } = await import("@/lib/external/flaresolverr");
    const result = await flaresolverrFetch("https://example.com");
    expect(result).toBeNull();
  });

  it("returns null when solution is missing", async () => {
    process.env.FLARESOLVERR_URL = ENDPOINT;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "ok" }),
      })
    );

    const { flaresolverrFetch } = await import("@/lib/external/flaresolverr");
    const result = await flaresolverrFetch("https://example.com");
    expect(result).toBeNull();
  });

  it("returns null and does not throw on network error", async () => {
    process.env.FLARESOLVERR_URL = ENDPOINT;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ECONNREFUSED"))
    );

    const { flaresolverrFetch } = await import("@/lib/external/flaresolverr");
    const result = await flaresolverrFetch("https://example.com");
    expect(result).toBeNull();
  });
});
