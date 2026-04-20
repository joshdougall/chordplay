import { describe, it, expect } from "vitest";
import { sanitize } from "@/lib/logger";

describe("sanitize", () => {
  it("strips token fields", () => {
    const result = sanitize({ token: "abc123", name: "josh" });
    expect(result).toEqual({ token: "[REDACTED]", name: "josh" });
  });

  it("strips secret fields", () => {
    const result = sanitize({ secret: "shh", data: "ok" });
    expect(result).toEqual({ secret: "[REDACTED]", data: "ok" });
  });

  it("strips authorization fields", () => {
    const result = sanitize({ authorization: "Bearer xyz", safe: "yes" });
    expect(result).toEqual({ authorization: "[REDACTED]", safe: "yes" });
  });

  it("strips apiKey fields", () => {
    const result = sanitize({ apiKey: "key-123", endpoint: "https://example.com" });
    expect(result).toEqual({ apiKey: "[REDACTED]", endpoint: "https://example.com" });
  });

  it("strips password fields", () => {
    const result = sanitize({ password: "hunter2", username: "josh" });
    expect(result).toEqual({ password: "[REDACTED]", username: "josh" });
  });

  it("handles nested objects", () => {
    const result = sanitize({
      user: { token: "secret-token", name: "josh" },
      level: "info"
    });
    expect(result).toEqual({
      user: { token: "[REDACTED]", name: "josh" },
      level: "info"
    });
  });

  it("handles arrays", () => {
    const result = sanitize([
      { accessToken: "tok1", id: 1 },
      { accessToken: "tok2", id: 2 }
    ]);
    expect(result).toEqual([
      { accessToken: "[REDACTED]", id: 1 },
      { accessToken: "[REDACTED]", id: 2 }
    ]);
  });

  it("preserves non-sensitive fields", () => {
    const result = sanitize({ artist: "The Beatles", title: "Hey Jude", provider: "chordie" });
    expect(result).toEqual({ artist: "The Beatles", title: "Hey Jude", provider: "chordie" });
  });

  it("passes through primitives unchanged", () => {
    expect(sanitize("hello")).toBe("hello");
    expect(sanitize(42)).toBe(42);
    expect(sanitize(null)).toBe(null);
    expect(sanitize(undefined)).toBe(undefined);
  });
});
