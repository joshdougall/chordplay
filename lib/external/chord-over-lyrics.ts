/**
 * Converts chord-over-lyrics plain text (chords on one line, lyrics on the next)
 * to ChordPro inline format: [Chord]lyric.
 *
 * If the input already contains inline [Chord] markers it is returned unchanged.
 */
export function chordsOverLyricsToChordPro(raw: string): string {
  // If [Chord] markers already inline (e.g. [G], [Am7], [D/F#]), leave as-is.
  // The pattern requires a chord letter followed by an optional modifier then ] or /
  // to avoid false-positives on section markers like [Chorus] or [Verse].
  if (/\[[A-G][#b]?(?:m|M|maj|min|aug|dim|sus|add|[0-9]|\/[A-G]|\])/.test(raw)) return raw;

  const lines = raw.split(/\r?\n/);
  const out: string[] = [];

  const isChordLine = (l: string): boolean => {
    const tokens = l.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return false;
    return tokens.every(t =>
      /^[A-G][#b]?(?:m|M|maj|min|aug|dim|sus|add)?[0-9]*(?:\/[A-G][#b]?)?$/.test(t)
    );
  };

  const merge = (chordLine: string, lyricLine: string): string => {
    const chords: Array<{ col: number; chord: string }> = [];
    const re = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(chordLine)) !== null) {
      chords.push({ col: m.index, chord: m[0] });
    }
    let result = lyricLine;
    for (let i = chords.length - 1; i >= 0; i--) {
      const { col, chord } = chords[i];
      const at = Math.min(col, result.length);
      result = result.slice(0, at) + `[${chord}]` + result.slice(at);
    }
    return result;
  };

  for (let i = 0; i < lines.length; i++) {
    if (
      isChordLine(lines[i]) &&
      i + 1 < lines.length &&
      lines[i + 1].trim() !== "" &&
      !isChordLine(lines[i + 1])
    ) {
      out.push(merge(lines[i], lines[i + 1]));
      i++;
    } else {
      out.push(lines[i]);
    }
  }
  return out.join("\n");
}
