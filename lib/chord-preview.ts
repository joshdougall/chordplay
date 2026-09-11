/**
 * Lets a chord token in the sheet ask the chord strip to show its diagram.
 *
 * When the strip is enabled it takes over the mobile band that the horizontal
 * diagram palette used to occupy, so on a phone there is no palette to scroll
 * to. The strip's own diagram is rendered outside `ChordProView`, so the
 * sheet's click handler cannot reach it through the DOM either, and tapping a
 * chord did nothing at all while still looking tappable.
 *
 * A window-level event is the channel because the two components have no
 * common ancestor that owns this state: the sheet renders inside the scroll
 * container and the strip renders above it, mounted by `app/page.tsx`.
 */

export const CHORD_PREVIEW_EVENT = "chordplay:preview-chord";

/** How long a tapped chord stays shown before the strip reverts to the chord
 *  that is actually playing. Long enough to read a shape, short enough that
 *  you are never confused about which chord is current. */
export const CHORD_PREVIEW_MS = 4000;

export type ChordPreviewDetail = { name: string };

/** Ask the strip to show `name` instead of the current chord, briefly. */
export function requestChordPreview(name: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ChordPreviewDetail>(CHORD_PREVIEW_EVENT, { detail: { name } })
  );
}

/** Read a chord name off a preview event, or null if it is malformed. */
export function readChordPreview(event: Event): string | null {
  const detail = (event as CustomEvent<ChordPreviewDetail>).detail;
  const name = detail?.name;
  return typeof name === "string" && name.trim().length > 0 ? name : null;
}
