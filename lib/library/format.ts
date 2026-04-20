export type Format = "chordpro" | "ascii-tab" | "guitar-pro";

export function detectFormat(filename: string, content: string): Format {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".gp") || lower.endsWith(".gpx") || lower.endsWith(".gp5")) return "guitar-pro";
  if (lower.endsWith(".pro") || lower.endsWith(".cho")) return "chordpro";
  const tabRegex = /^\s*[eEBGDAE][\|].+$/m;
  return tabRegex.test(content) ? "ascii-tab" : "chordpro";
}
