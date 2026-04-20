"use client";

import { useEffect } from "react";

type Bindings = Record<string, () => void>;

export function useKeyboardShortcuts(bindings: Bindings) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore if typing in an input/textarea/contenteditable
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const key = (e.shiftKey ? "Shift+" : "") + (e.ctrlKey ? "Ctrl+" : "") + (e.metaKey ? "Meta+" : "") + e.key;
      const handler = bindings[key];
      if (handler) { e.preventDefault(); handler(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bindings]);
}
