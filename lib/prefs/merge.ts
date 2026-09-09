import type { Prefs } from "./defaults";

/**
 * Merge an incoming partial preferences payload over the stored one.
 *
 * Extracted from the PUT handler because the handler rebuilt Prefs from an
 * explicit field list that omitted autoScrollSpeed and fontScale, so both
 * reverted to their defaults on every save. A list like that silently drops
 * every field added after it was written.
 */
export function mergePrefs(body: Partial<Prefs>, current: Prefs): Prefs {
  return {
    autoScroll: body.autoScroll ?? current.autoScroll,
    autoScrollSpeed: body.autoScrollSpeed ?? current.autoScrollSpeed,
    showChordDiagrams: body.showChordDiagrams ?? current.showChordDiagrams,
    songPreferences: body.songPreferences ?? current.songPreferences,
    trackOverrides: body.trackOverrides ?? current.trackOverrides,
    songTranspose: body.songTranspose ?? current.songTranspose,
    preferredVersion: body.preferredVersion ?? current.preferredVersion,
    splitView: body.splitView ?? current.splitView,
    fontScale: body.fontScale ?? current.fontScale,
    chordStrip: body.chordStrip ?? current.chordStrip,
  };
}
