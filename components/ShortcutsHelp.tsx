"use client";

import { useEffect } from "react";

const SHORTCUTS = [
  { key: "Space / k", description: "Play / Pause" },
  { key: "j / ←", description: "Previous track" },
  { key: "l / →", description: "Next track" },
  { key: "t", description: "Transpose up" },
  { key: "Shift+T", description: "Transpose down" },
  { key: "0", description: "Reset transpose" },
  { key: "a", description: "Toggle auto-scroll" },
  { key: "e", description: "Open/close editor" },
  { key: "/", description: "Focus library filter (Library page)" },
  { key: "?", description: "Show/hide this help" },
];

export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="rounded-lg p-6 max-w-sm w-full mx-4 shadow-2xl"
        style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="text-sm"
            style={{ color: "var(--ink-faint)" }}
          >
            ✕
          </button>
        </div>
        <ul className="flex flex-col gap-2">
          {SHORTCUTS.map(s => (
            <li key={s.key} className="flex items-center justify-between text-sm">
              <span style={{ color: "var(--ink-muted)" }}>{s.description}</span>
              <kbd
                className="px-2 py-0.5 rounded text-xs font-mono"
                style={{ backgroundColor: "var(--bg-alt)", color: "var(--accent)", border: "1px solid var(--border)" }}
              >
                {s.key}
              </kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
