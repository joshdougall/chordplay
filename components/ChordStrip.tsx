"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PlaybackClock } from "@/hooks/usePlaybackClock";
import { cueIndexAtFraction, type ChordCue } from "@/lib/playback/sheet-map";
import { ChordDiagram } from "@/components/ChordDiagram";

type Props = {
  enabled: boolean;
  /** From the match's format. NOT from whether .chord elements exist right now:
   *  content is nulled on every track change, so a DOM test would unmount the
   *  band between every song. */
  isChordSheet: boolean;
  clock: PlaybackClock | null;
  durationMs: number;
  isPlaying: boolean;
  /** From useSheetMap, which owns rebuilds and retains the outgoing song's
   *  cues across a track change. This component only renders them. */
  cues: ChordCue[];
};

export function ChordStrip({
  enabled,
  isChordSheet,
  clock,
  durationMs,
  isPlaying,
  cues,
}: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const cueRefs = useRef<HTMLSpanElement[]>([]);
  const rafRef = useRef<number | null>(null);

  // Drop refs beyond the current cue count, so a shorter sheet cannot leave
  // stale elements behind for the slide to measure. In a layout effect rather
  // than during render, since ref callbacks have already run by then.
  useLayoutEffect(() => { cueRefs.current.length = cues.length; }, [cues]);

  // Slide the track so the current cue sits on the centre rail.
  useEffect(() => {
    if (!enabled || !isChordSheet || cues.length === 0) return;
    if (!clock || durationMs <= 0) return;

    const step = () => {
      const pct = clock.getProgressMs() / durationMs;
      const idx = cueIndexAtFraction(pct, cues);
      if (idx >= 0) {
        setCurrentIdx(prev => (prev === idx ? prev : idx));
        const el = cueRefs.current[idx];
        const track = trackRef.current;
        if (el && track) {
          const offset = el.offsetLeft + el.offsetWidth / 2;
          track.style.transform = `translate3d(${-offset}px, 0, 0)`;
        }
      }
      // Motion only while playing; the marker stays where it was on pause.
      if (isPlaying) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [enabled, isChordSheet, cues, clock, durationMs, isPlaying]);

  if (!enabled || !isChordSheet) return null;

  const showMarker = clock !== null && durationMs > 0 && cues.length > 0;
  const currentName = showMarker ? cues[currentIdx]?.name : undefined;

  return (
    <div
      className="flex items-center gap-2 overflow-hidden"
      style={{ height: "var(--chord-strip-h)", backgroundColor: "var(--bg)" }}
    >
      {currentName && (
        // Mobile only: this replaces the horizontal diagram palette, so the
        // current chord's shape has to be reachable without it.
        <div className="chord-strip-diagram md:hidden shrink-0 pl-2" data-chord-diagram={currentName}>
          <ChordDiagram name={currentName} size="sm" />
        </div>
      )}
      <div className="chord-strip flex-1" aria-label="Chord sequence" role="group">
        <div ref={trackRef} className="chord-strip-track">
          {cues.map((cue, i) => (
            <span
              key={`${i}-${cue.name}`}
              ref={el => { if (el) cueRefs.current[i] = el; }}
              className="chord-strip-cue"
              data-state={
                !showMarker ? "upcoming"
                  : i === currentIdx ? "current"
                  : i < currentIdx ? "played"
                  : "upcoming"
              }
            >
              {cue.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
