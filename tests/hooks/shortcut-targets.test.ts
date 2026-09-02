import { describe, it, expect } from "vitest";
import { shouldIgnoreTarget, keyFor } from "@/hooks/useKeyboardShortcuts";

/** Minimal stand-in for the DOM bits shouldIgnoreTarget actually reads. */
function el(tagName: string, opts: { editable?: boolean; ancestor?: string | null } = {}) {
  return {
    tagName,
    isContentEditable: opts.editable ?? false,
    closest: (sel: string) => (opts.ancestor && sel.includes(opts.ancestor) ? {} : null),
  } as unknown as EventTarget;
}

describe("shouldIgnoreTarget", () => {
  it("ignores typing in a text field", () => {
    expect(shouldIgnoreTarget(el("INPUT"))).toBe(true);
    expect(shouldIgnoreTarget(el("TEXTAREA"))).toBe(true);
    expect(shouldIgnoreTarget(el("SELECT"))).toBe(true);
    expect(shouldIgnoreTarget(el("DIV", { editable: true }))).toBe(true);
  });

  it("leaves a focused button alone", () => {
    // Space on a focused transpose button used to toggle Spotify playback
    // instead of activating the button, because preventDefault cancelled it.
    expect(shouldIgnoreTarget(el("BUTTON", { ancestor: "button" }))).toBe(true);
  });

  it("leaves a focused chord alone", () => {
    expect(shouldIgnoreTarget(el("SPAN", { ancestor: '[role="button"]' }))).toBe(true);
  });

  it("still handles a keystroke on the page body", () => {
    expect(shouldIgnoreTarget(el("DIV"))).toBe(false);
    expect(shouldIgnoreTarget(el("BODY"))).toBe(false);
  });

  it("tolerates a null target", () => {
    expect(shouldIgnoreTarget(null)).toBe(false);
  });
});

describe("keyFor", () => {
  it("builds the plain key", () => {
    expect(keyFor({ key: "a", shiftKey: false, ctrlKey: false, metaKey: false })).toBe("a");
  });

  it("prefixes modifiers in a stable order", () => {
    expect(keyFor({ key: "T", shiftKey: true, ctrlKey: false, metaKey: false })).toBe("Shift+T");
    expect(keyFor({ key: "s", shiftKey: true, ctrlKey: true, metaKey: true })).toBe("Shift+Ctrl+Meta+s");
  });
});
