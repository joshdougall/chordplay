"use client";

import { useEffect, useRef, useState } from "react";
import { buildLiveSheetMap, type LiveSheetMap } from "@/lib/playback/sheet-lines";
import type { ChordCue } from "@/lib/playback/sheet-map";

/** Trailing debounce on rebuilds. Diagram paints and reflows arrive in bursts;
 *  rebuilding once per mutation is wasted work. */
const REBUILD_DEBOUNCE_MS = 100;

/** Retry ladder for a sheet that has not painted yet when we first read it. */
const PAINT_RETRIES_MS = [50, 200, 600];

/**
 * The single owner of sheet-map rebuilds.
 *
 * AutoScroller, ChordStrip and useCurrentLine all need the same map. Each
 * owning its own observers meant three copies of this logic and three reads of
 * the sheet on every transpose, resize and diagram paint.
 */
export function useSheetMap({
  enabled,
  containerRef,
  rebuildKey,
}: {
  enabled: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
  rebuildKey: string;
}): { map: LiveSheetMap | null; cues: ChordCue[] } {
  const [state, setState] = useState<{ map: LiveSheetMap | null; cues: ChordCue[] }>({
    map: null,
    cues: [],
  });
  // Retained so the outgoing song's cues survive the load gap: page.tsx nulls
  // `content` on every track change, and blanking the strip would reflow the band.
  const lastCuesRef = useRef<ChordCue[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || !container) return;

    let debounce: number | null = null;

    const rebuild = () => {
      const built = buildLiveSheetMap(container);
      if (built.cues.length > 0) lastCuesRef.current = built.cues;
      setState({
        map: built.map,
        cues: built.cues.length > 0 ? built.cues : lastCuesRef.current,
      });
    };

    const schedule = () => {
      if (debounce !== null) window.clearTimeout(debounce);
      debounce = window.setTimeout(rebuild, REBUILD_DEBOUNCE_MS);
    };

    rebuild();
    const timers = PAINT_RETRIES_MS.map(ms => window.setTimeout(rebuild, ms));

    // Observe the CONTAINER, not the sheet element.
    //
    // The obvious version resolves the sheet once and observes that, but on a
    // track change page.tsx sets content to null, then the match arrives, then
    // the content arrives. The effect re-runs on the match render, when there
    // is no sheet in the DOM at all, so nothing gets observed and only the
    // paint-retry ladder can ever build the map. A slow /api/library/[id]
    // response past 600ms left the map null for the whole song. Toggling split
    // view swaps one sheet element for another without changing rebuildKey,
    // which would leave the observers and every unitElement on detached nodes.
    //
    // buildLiveSheetMap re-resolves the sheet on each rebuild, so a
    // container-scoped observer picks up a late mount and a swap for free.
    const mo = new MutationObserver(records => {
      // Chord diagrams render asynchronously and replace their own children.
      // Those mutations cannot move a sheet line, and rebuilding on each of
      // them is the waste that scoping to the sheet was meant to avoid, so
      // filter them out here instead.
      const allDiagramNoise = records.every(r => {
        const t = r.target;
        return t instanceof Element && t.closest("[data-chord-diagram], .chord-strip") !== null;
      });
      if (allDiagramNoise) return;
      schedule();
    });
    mo.observe(container, { childList: true, subtree: true });

    // Catches the text-size controls, which write --sheet-scale to
    // documentElement: that reflows every line without mutating the DOM and
    // without resizing the window. Observing the container's content wrapper
    // rather than the sheet also catches the mobile diagram palette changing
    // height as its SVGs paint, which shifts every line below it.
    const ro = new ResizeObserver(schedule);
    const roTarget = container.firstElementChild ?? container;
    ro.observe(roTarget);

    return () => {
      mo.disconnect();
      ro.disconnect();
      if (debounce !== null) window.clearTimeout(debounce);
      timers.forEach(t => window.clearTimeout(t));
    };
  }, [enabled, containerRef, rebuildKey]);

  return state;
}
