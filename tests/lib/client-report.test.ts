import { describe, it, expect } from "vitest";
import { buildClientLogLine, MAX_CLIENT_LOG_BYTES } from "@/lib/client-report";

describe("buildClientLogLine", () => {
  it("keeps only the fields worth logging", () => {
    const out = buildClientLogLine({
      msg: "boom", level: "error",
      location: "/library", filename: "app.js", lineno: 42, name: "TypeError",
      stack: "TypeError: boom\n  at x",
      // Not on the allowlist: an attacker's payload, or just noise.
      padding: "x".repeat(5000), cookie: "secret", nested: { deep: true },
    });
    expect(out.location).toBe("/library");
    expect(out.filename).toBe("app.js");
    expect(out.lineno).toBe(42);
    expect(out.name).toBe("TypeError");
    expect(out).not.toHaveProperty("padding");
    expect(out).not.toHaveProperty("cookie");
    expect(out).not.toHaveProperty("nested");
  });

  it("truncates a long stack rather than logging all of it", () => {
    const out = buildClientLogLine({ msg: "x", stack: "y".repeat(10_000) });
    expect((out.stack as string).length).toBeLessThanOrEqual(2100);
  });

  it("truncates a long message", () => {
    const out = buildClientLogLine({ msg: "z".repeat(10_000) });
    expect((out.msg as string).length).toBeLessThanOrEqual(600);
  });

  it("coerces a non-string message safely", () => {
    expect(buildClientLogLine({ msg: { a: 1 } }).msg).toBeTypeOf("string");
    expect(buildClientLogLine({}).msg).toBeTypeOf("string");
  });

  it("caps the accepted body well below anything that could fill a disk", () => {
    // 8KB: enough for a stack trace, nowhere near enough to be a write primitive.
    expect(MAX_CLIENT_LOG_BYTES).toBeLessThanOrEqual(8192);
  });
});
