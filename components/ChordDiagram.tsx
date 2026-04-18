"use client";

import { useEffect, useRef } from "react";
import { lookupChord } from "@/lib/chord-diagrams/chord-lookup";

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

    const container = containerRef.current;
    const width = SIZE_MAP[size];
    let cancelled = false;

    async function render() {
      const chord = await lookupChord(name);

      if (cancelled || !container) return;

      if (!chord) {
        container.innerHTML = `<div style="font-size:0.7rem;color:var(--ink-faint);text-align:center;padding:4px 2px">${name}</div>`;
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
