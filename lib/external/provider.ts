export type ExternalChords = {
  source: string;      // provider id, e.g. "chordie", "e-chords"
  sourceName: string;  // human label, e.g. "Chordie", "E-Chords"
  sourceUrl: string;
  content: string;     // ChordPro-formatted
  title: string;
  artist: string;
  rating?: number;
};

export interface ChordProvider {
  id: string;
  name: string;
  fetch(artist: string, title: string): Promise<ExternalChords | null>;
}
