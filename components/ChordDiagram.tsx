"use client";

import { useEffect, useRef } from "react";
import { CHORD_DB, normalizeChord } from "@/lib/chord-diagrams/chord-db";

const SIZE_MAP = { sm: 90, md: 120, lg: 180 } as const;

export function ChordDiagram({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const key = normalizeChord(name);
    if (!key || !CHORD_DB[key]) {
      containerRef.current.innerHTML = `<div style="font-size:0.7rem;color:var(--ink-faint);text-align:center;padding:4px 2px">${name}</div>`;
      return;
    }

    const width = SIZE_MAP[size];

    // Dynamic import keeps svguitar out of the SSR bundle
    import("svguitar").then(({ SVGuitarChord }) => {
      if (!containerRef.current) return;
      containerRef.current.innerHTML = "";
      const chart = new SVGuitarChord(containerRef.current);
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
        .chord(CHORD_DB[key])
        .draw();

      // Scale the generated SVG to fit the size bucket
      const svg = containerRef.current.querySelector("svg");
      if (svg) {
        svg.style.width = `${width}px`;
        svg.style.height = "auto";
      }
    });

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = "";
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
