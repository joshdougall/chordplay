import { test, expect } from "@playwright/test";

// These API routes mutate or expose the shared library / trigger outbound work.
// Without a session cookie (fresh `request` context has none) they must all 401.
test.describe("API routes reject unauthenticated access", () => {
  test("GET /api/library/all → 401", async ({ request }) => {
    const res = await request.get("/api/library/all");
    expect(res.status()).toBe(401);
  });

  test("GET /api/library/[id] → 401", async ({ request }) => {
    const res = await request.get("/api/library/anything.pro");
    expect(res.status()).toBe(401);
  });

  test("POST /api/library → 401", async ({ request }) => {
    const res = await request.post("/api/library", {
      data: { title: "x", format: "chordpro", content: "[C]hi" },
    });
    expect(res.status()).toBe(401);
  });

  test("PUT /api/library/[id] → 401", async ({ request }) => {
    const res = await request.put("/api/library/anything.pro", {
      data: { content: "[C]hi" },
    });
    expect(res.status()).toBe(401);
  });

  test("DELETE /api/library/[id] → 401", async ({ request }) => {
    const res = await request.delete("/api/library/anything.pro");
    expect(res.status()).toBe(401);
  });

  test("GET /api/external/chords → 401", async ({ request }) => {
    const res = await request.get("/api/external/chords?artist=a&title=b");
    expect(res.status()).toBe(401);
  });

  test("POST /api/issue → 401", async ({ request }) => {
    const res = await request.post("/api/issue", {
      data: { title: "spam", description: "spam" },
    });
    expect(res.status()).toBe(401);
  });
});
