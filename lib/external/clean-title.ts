/**
 * Strip Spotify-style suffixes from a track title before searching external
 * providers. Spotify tracks often have " - Remastered 2015", " - Bonus Track",
 * "(feat. X)", " - Live at Y", etc. These kill search hits on every external
 * chord site. The underlying song is what we want.
 *
 * Example:
 *   "Bloom - Bonus Track"           → "Bloom"
 *   "Hey Jude - Remastered 2015"    → "Hey Jude"
 *   "Shallow (feat. Bradley Cooper)" → "Shallow"
 *   "Creep (Acoustic Version)"      → "Creep"
 *   "No Such Thing - Live at Fillmore" → "No Such Thing"
 */
export function cleanTitleForSearch(title: string): string {
  let t = title;

  // Strip parenthetical qualifiers like "(feat. X)", "(Live)", "(Acoustic)", "(Remix)"
  t = t.replace(/\s*\((?:feat\.?|ft\.?|with|live|acoustic|remix|remastered|remaster|edit|version|deluxe|bonus|extended|radio|original|studio|demo|explicit|clean|instrumental|karaoke)[^)]*\)/gi, "");

  // Strip " - <Qualifier>" trailing suffixes (common Spotify format)
  t = t.replace(/\s*-\s*(?:feat\.?|ft\.?|live|acoustic|remix|remastered(?:\s+\d{4})?|remaster|edit|version|deluxe(?:\s+edition)?|bonus\s+track|extended(?:\s+version)?|radio\s+edit|original|studio|demo|explicit|clean|instrumental|karaoke|single\s+version|mono\s+version|stereo|\d{4}\s+remaster).*$/gi, "");

  // Strip bracketed qualifiers like "[Remastered]"
  t = t.replace(/\s*\[(?:feat\.?|ft\.?|live|acoustic|remix|remastered|remaster|edit|version|deluxe|bonus|extended|radio|original|studio|demo|explicit|clean|instrumental|karaoke)[^\]]*\]/gi, "");

  return t.trim();
}

/**
 * Strip "feat." and similar from the artist field. "Morgan Wallen (feat. Post Malone)"
 * → "Morgan Wallen". We search on the primary artist only.
 */
export function cleanArtistForSearch(artist: string): string {
  let a = artist;
  a = a.replace(/\s*\((?:feat\.?|ft\.?|with)[^)]*\)/gi, "");
  a = a.replace(/\s*(?:feat\.?|ft\.?)\s+.*$/gi, "");
  // If comma-separated, take the first artist for the search (combine later if needed)
  a = a.split(",")[0].trim();
  return a;
}
