"use client";

import { useEffect, useRef, useState } from "react";
import { lookupChord } from "@/lib/chord-diagrams/chord-lookup";
import type { UserChordDb } from "@/lib/chord-diagrams/user-chord-db";

const SIZE_MAP = { sm: 90, md: 120, lg: 180 } as const;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

// Module-level cache so we only fetch overrides once per session.
// Cleared and refetched when the "chord-diagrams-changed" event fires.
let overridesCache: UserChordDb | null = null;
let overridesFetchPromise: Promise<UserChordDb> | null = null;

function fetchOverrides(): Promise<UserChordDb> {
  if (overridesFetchPromise) return overridesFetchPromise;
  overridesFetchPromise = fetch("/api/chord-diagrams")
    .then(r => r.json())
    .then((body: { overrides?: UserChordDb }) => {
      overridesCache = body.overrides ?? {};
      return overridesCache;
    })
    .catch(() => {
      overridesFetchPromise = null;
      return {};
    });
  return overridesFetchPromise;
}

function invalidateOverridesCache() {
  overridesCache = null;
  overridesFetchPromise = null;
}

if (typeof window !== "undefined") {
  window.addEventListener("chord-diagrams-changed", invalidateOverridesCache);
}

export function ChordDiagram({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setOverrides] = useState<UserChordDb | null>(null);

  // Trigger re-render when overrides change
  useEffect(() => {
    function onChanged() {
      invalidateOverridesCache();
      fetchOverrides().then(o => setOverrides({ ...o }));
    }
    window.addEventListener("chord-diagrams-changed", onChanged);
    return () => window.removeEventListener("chord-diagrams-changed", onChanged);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = SIZE_MAP[size];
    let cancelled = false;

    async function render() {
      const overrides = overridesCache ?? await fetchOverrides();
      const chord = await lookupChord(name, overrides);

      if (cancelled || !container) return;

      if (!chord) {
        container.innerHTML = `
          <div class="chord-diagram-placeholder" style="
            width: ${width}px;
            height: ${Math.round(width * 1.15)}px;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            gap: 0.25rem;
            border: 1px dashed var(--border);
            border-radius: 6px;
            padding: 0.5rem;
            color: var(--ink-faint);
            box-sizing: border-box;
          ">
            <div style="font-weight: 600; color: var(--accent);">${escapeHtml(name)}</div>
            <div style="font-size: 0.65rem; color: var(--ink-faint); text-align: center;">no diagram</div>
          </div>
        `;
        return;
      }

      // Dynamic import keeps svguitar out of the SSR bundle
      const { SVGuitarChord } = await import("svguitar");

      if (cancelled || !container) return;

      container.innerHTML = "";
      const chart = new SVGuitarChord(container);
      chart
        .configure({
          title: name,
          color: "#e8b86b",
          backgroundColor: "transparent",
          fingerColor: "#e8b86b",
          fingerTextColor: "#1a1612",
          fontFamily: "JetBrains Mono, monospace",
          fingerSize: 0.65,
          strokeWidth: 1,
          // Scale the diagram to fit the requested size bucket
          // svguitar doesn't take a direct width — it sizes from string/fret spacing.
          // We wrap in a fixed-width container and let the SVG scale via CSS.
          strings: 6,
          frets: 4,
          noPosition: false,
          fixedDiagramPosition: true,
          titleFontSize: 38,
        })
        .chord(chord)
        .draw();

      // Scale the generated SVG to fit the size bucket
      const svg = container.querySelector("svg");
      if (svg) {
        svg.style.width = `${width}px`;
        svg.style.height = "auto";
      }
    }

    render();

    return () => {
      cancelled = true;
      if (container) container.innerHTML = "";
    };
  }, [name, size]);

  return (
    <div
      ref={containerRef}
      className="chord-diagram flex-shrink-0"
      style={{ width: SIZE_MAP[size], minHeight: Math.round(SIZE_MAP[size] * 1.3) }}
      title={name}
    />
  );
}
