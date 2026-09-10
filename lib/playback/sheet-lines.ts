import {
  buildSheetMap,
  buildChordMap,
  type LineFacts,
  type SheetMap,
  type ChordCue,
} from "@/lib/playback/sheet-map";

/** A SheetMap with its highlight targets resolved to elements, so the
 *  highlight never queries the DOM during playback. */
export type LiveSheetMap = SheetMap & { unitElements: HTMLElement[] };

/**
 * Locate the rendered sheet within the scroll container. Either the inline
 * formatter's `.chordpro` or the positional renderer's `.chordpro-pre`.
 *
 * NOT used to scope the rebuild observer — see `hooks/useSheetMap.ts`, which
 * observes the container instead and filters out diagram-paint noise, because
 * a sheet-scoped observer misses the sheet's own (re)mount.
 */
export function findSheetElement(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>(".chordpro, .chordpro-pre");
}

/**
 * Read line geometry out of the rendered sheet.
 *
 * Both renderers are handled: the inline formatter emits `.row` divs, while
 * positional sheets are a <pre> of one span per source line.
 */
export function readSheetLines(
  sheetEl: HTMLElement,
  container: HTMLElement
): { facts: LineFacts[]; elements: HTMLElement[] } {
  // Line tops must be in the scroll container's content space, because
  // weightedProgressToScrollTop returns them straight back as scrollTop.
  // `offsetTop` measures from the nearest POSITIONED ancestor and there is
  // none: globals.css has no `position` rule, <body> and <main> are static,
  // and the scroll container is `flex-1 overflow-auto` with no position. So
  // offsetParent is <body> and offsetTop is inflated by the site header, the
  // control bar and the version bar. This is the geometry the shipping
  // buildRowMap used, and getting it wrong scrolls every sheet ahead of the
  // music by that height.
  const frameTop = container.getBoundingClientRect().top - container.scrollTop;
  const isPositional = sheetEl.classList.contains("chordpro-pre");
  const lineEls = isPositional
    ? Array.from(sheetEl.children).filter((c): c is HTMLElement => c instanceof HTMLElement)
    : Array.from(sheetEl.querySelectorAll<HTMLElement>(".row"));

  const facts: LineFacts[] = [];
  const elements: HTMLElement[] = [];

  for (const el of lineEls) {
    const chordEls = Array.from(el.querySelectorAll<HTMLElement>(".chord"));
    const chordNames: string[] = [];
    const chordLefts: number[] = [];

    // Lyric text is everything that is not a chord token. Computed by removing
    // each chord's own text from the line, so it works for both renderers
    // rather than only for the inline one's `.lyrics` divs.
    let remainder = el.textContent ?? "";

    for (const c of chordEls) {
      const raw = c.textContent ?? "";
      const name = raw.trim();
      if (!name) continue;
      chordNames.push(name);
      // offsetLeft is fine here: only intra-line ORDER is used, never absolute
      // position, and offsetLeft is monotonic left-to-right within a line.
      chordLefts.push(c.offsetLeft);
      const at = remainder.indexOf(raw);
      if (at >= 0) remainder = remainder.slice(0, at) + remainder.slice(at + raw.length);
    }

    const hasLyricText = remainder.trim().length > 0;
    // Positional-sheet section headers ("Verse 1") render as a `.sheet-section`
    // span; the line element either IS that span or contains it.
    const isSectionHeader =
      el.matches(".sheet-section") || el.querySelector(".sheet-section") !== null;

    facts.push({
      top: el.getBoundingClientRect().top - frameTop,
      chordCount: chordNames.length,
      chordNames,
      chordLefts,
      hasLyricText,
      isSectionHeader,
    });
    elements.push(el);
  }

  return { facts, elements };
}

/** Read the sheet and build both maps in one pass. */
export function buildLiveSheetMap(
  container: HTMLElement
): { map: LiveSheetMap | null; facts: LineFacts[]; cues: ChordCue[] } {
  const sheetEl = findSheetElement(container);
  if (!sheetEl) return { map: null, facts: [], cues: [] };

  const { facts, elements } = readSheetLines(sheetEl, container);
  const base = buildSheetMap(facts);
  if (!base) return { map: null, facts, cues: [] };

  const unitElements = base.unitLineIndex.map(i => elements[i]);
  return {
    map: { ...base, unitElements },
    facts,
    cues: buildChordMap(base, facts),
  };
}
