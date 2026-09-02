"use client";

import { useEffect, useRef } from "react";

type Bindings = Record<string, () => void>;

/**
 * Should this keystroke be left alone?
 *
 * Exported and pure so it is actually testable. The existing hook test
 * re-implements the handler inside the test file, so it cannot catch a change
 * in here.
 */
export function shouldIgnoreTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
  if (el.isContentEditable) return true;
  // A focusable control owns its own keys. preventDefault on Space used to
  // cancel activation of whatever button had focus, so Space on a focused
  // transpose button toggled Spotify instead of transposing.
  return typeof el.closest === "function"
    && el.closest('button, [role="button"], a[href], select, textarea, input') !== null;
}

/** Canonical binding key for an event, e.g. "Shift+T". */
export function keyFor(e: Pick<KeyboardEvent, "key" | "shiftKey" | "ctrlKey" | "metaKey">): string {
  return (e.shiftKey ? "Shift+" : "") + (e.ctrlKey ? "Ctrl+" : "") + (e.metaKey ? "Meta+" : "") + e.key;
}

/**
 * Global keyboard shortcuts.
 *
 * `enabled` exists because these stayed live while a modal was open, so
 * pressing "a" inside the shortcuts help silently toggled auto-scroll and "t"
 * transposed the sheet hidden behind it.
 *
 * Bindings are held in a ref rather than being an effect dependency: the caller
 * passes a fresh object literal every render, and the page re-renders on every
 * 2s poll, so the listener was being removed and re-added 30 times a minute.
 */
export function useKeyboardShortcuts(bindings: Bindings, enabled: boolean = true) {
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  useEffect(() => {
    if (!enabled) return;

    const onKey = (e: KeyboardEvent) => {
      if (shouldIgnoreTarget(e.target)) return;
      const key = keyFor(e);
      const handler = bindingsRef.current[key];
      if (handler) { e.preventDefault(); handler(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
