"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PlaybackClock } from "@/hooks/usePlaybackClock";
import { cueIndexAtFraction, type ChordCue } from "@/lib/playback/sheet-map";
import { ChordDiagram } from "@/components/ChordDiagram";
import { CHORD_PREVIEW_EVENT, CHORD_PREVIEW_MS, readChordPreview } from "@/lib/chord-preview";

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
  // A chord tapped in the sheet, shown instead of the playing chord for a few
  // seconds. Carries a timestamp so tapping the same chord twice is a new
  // object and restarts the timer below.
  const [preview, setPreview] = useState<{ name: string; at: number } | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const cueRefs = useRef<HTMLSpanElement[]>([]);
  const rafRef = useRef<number | null>(null);

  // Drop refs beyond the current cue count, so a shorter sheet cannot leave
  // stale elements behind for the slide to measure. In a layout effect rather
  // than during render, since ref callbacks have already run by then.
  useLayoutEffect(() => { cueRefs.current.length = cues.length; }, [cues]);

  // The sheet cannot reach this component through the DOM (it renders inside
  // the scroll container, this renders above it), so it asks via an event.
  useEffect(() => {
    if (!enabled || !isChordSheet) return;
    const onPreview = (event: Event) => {
      const name = readChordPreview(event);
      if (name) setPreview({ name, at: Date.now() });
    };
    window.addEventListener(CHORD_PREVIEW_EVENT, onPreview);
    return () => window.removeEventListener(CHORD_PREVIEW_EVENT, onPreview);
  }, [enabled, isChordSheet]);

  // Revert to the playing chord. Keyed off the whole object so a repeat tap
  // restarts the countdown rather than letting the first one expire.
  useEffect(() => {
    if (preview === null) return;
    const t = window.setTimeout(() => setPreview(null), CHORD_PREVIEW_MS);
    return () => window.clearTimeout(t);
  }, [preview]);

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
  // A tapped chord wins over the playing one, and can show even when nothing
  // is playing, which is exactly when someone is looking a shape up.
  const diagramName = preview?.name ?? currentName;

  return (
    <div
      className="flex items-center gap-2 overflow-hidden"
      style={{ height: "var(--chord-strip-h)", backgroundColor: "var(--bg)" }}
    >
      {diagramName && (
        // Mobile only: this replaces the horizontal diagram palette, so a
        // chord's shape has to be reachable without it, both for the chord
        // that is playing and for one the player taps in the sheet.
        <div
          className="chord-strip-diagram md:hidden shrink-0 pl-2"
          data-chord-diagram={diagramName}
          data-preview={preview ? "true" : undefined}
        >
          <ChordDiagram name={diagramName} size="sm" />
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
