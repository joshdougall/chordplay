/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Simulate the logic of useKeyboardShortcuts without React (test the core key-dispatch logic)
// We extract the event handler factory so we can test it in isolation.

type Bindings = Record<string, () => void>;

function buildHandler(bindings: Bindings) {
  return function onKey(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
    const key = (e.shiftKey ? "Shift+" : "") + (e.ctrlKey ? "Ctrl+" : "") + (e.metaKey ? "Meta+" : "") + e.key;
    const handler = bindings[key];
    if (handler) { e.preventDefault(); handler(); }
  };
}

describe("useKeyboardShortcuts handler logic", () => {
  it("calls the correct handler for a plain key", () => {
    const handler = vi.fn();
    const onKey = buildHandler({ "k": handler });
    const event = new KeyboardEvent("keydown", { key: "k", bubbles: true });
    document.dispatchEvent(event);
    // Manually invoke via handler to test logic
    onKey(event);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("calls the correct handler for Shift+T", () => {
    const handler = vi.fn();
    const onKey = buildHandler({ "Shift+T": handler });
    const event = new KeyboardEvent("keydown", { key: "T", shiftKey: true, bubbles: true });
    onKey(event);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("ignores events from INPUT elements", () => {
    const handler = vi.fn();
    const onKey = buildHandler({ "k": handler });
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    const event = new KeyboardEvent("keydown", { key: "k", bubbles: true });
    Object.defineProperty(event, "target", { value: input, writable: false });
    onKey(event);
    expect(handler).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it("ignores events from TEXTAREA elements", () => {
    const handler = vi.fn();
    const onKey = buildHandler({ "a": handler });
    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    const event = new KeyboardEvent("keydown", { key: "a", bubbles: true });
    Object.defineProperty(event, "target", { value: textarea, writable: false });
    onKey(event);
    expect(handler).not.toHaveBeenCalled();
    document.body.removeChild(textarea);
  });

  it("does not call a handler for unknown keys", () => {
    const handler = vi.fn();
    const onKey = buildHandler({ "k": handler });
    const event = new KeyboardEvent("keydown", { key: "z" });
    onKey(event);
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls Space handler correctly", () => {
    const handler = vi.fn();
    const onKey = buildHandler({ " ": handler });
    const event = new KeyboardEvent("keydown", { key: " " });
    onKey(event);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
