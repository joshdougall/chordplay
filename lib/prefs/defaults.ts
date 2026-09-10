export type Prefs = {
  autoScroll: boolean;
  autoScrollSpeed?: number;
  showChordDiagrams: boolean;
  songPreferences: Record<string, "chords" | "tab">;
  trackOverrides: Record<string, string>;
  songTranspose: Record<string, number>;
  preferredVersion: Record<string, string>;
  splitView?: Record<string, boolean>;
  /** Sheet text scale multiplier. 1 = the original hard-coded 16px. */
  fontScale?: number;
  /** Chord strip visibility. Declared here ahead of the strip component
   *  itself, because useSheetMap needs to know whether it's on to decide
   *  whether to keep the sheet map current even with the strip unmounted. */
  chordStrip?: boolean;
};

/**
 * Kept free of node: imports so client components can fall back to it when
 * /api/prefs is unreachable, without pulling the filesystem store into the
 * browser bundle.
 */
export const DEFAULT_PREFS: Prefs = {
  autoScroll: false,
  autoScrollSpeed: 1,
  showChordDiagrams: true,
  songPreferences: {},
  trackOverrides: {},
  songTranspose: {},
  preferredVersion: {},
  splitView: {},
  fontScale: 1,
  chordStrip: false
};
