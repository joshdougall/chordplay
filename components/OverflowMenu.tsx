"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type OverflowMenuItem = { label: string; onClick: () => void; danger?: boolean; disabled?: boolean };

type Props = { items: OverflowMenuItem[] };

export function OverflowMenu({ items }: Props) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  function toggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen(v => !v);
  }

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    function onPointer(e: PointerEvent) {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const menu = open && coords ? createPortal(
    <div
      style={{
        position: "fixed",
        top: coords.top,
        right: coords.right,
        zIndex: 9999,
        minWidth: "10rem",
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "6px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        overflow: "hidden",
      }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => { item.onClick(); setOpen(false); }}
          disabled={item.disabled}
          style={{
            display: "block",
            width: "100%",
            textAlign: "left",
            padding: "0.5rem 0.75rem",
            fontSize: "0.8125rem",
            color: item.danger ? "var(--danger)" : "var(--ink)",
            backgroundColor: "transparent",
            border: "none",
            cursor: item.disabled ? "not-allowed" : "pointer",
            opacity: item.disabled ? 0.4 : 1,
            borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none",
          }}
          onMouseEnter={e => { if (!item.disabled) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-alt)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="px-2 py-1 rounded text-sm"
        style={{ backgroundColor: "var(--bg-surface)", color: "var(--ink-muted)", border: "1px solid var(--border)" }}
        aria-label="More actions"
        title="More actions"
      >
        ⋯
      </button>
      {menu}
    </>
  );
}
