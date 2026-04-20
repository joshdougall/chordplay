export type Metadata = {
  title: string;
  artist: string;
  spotifyTrackId?: string;
  versionName?: string;
};

export function parseMetadata(filename: string, content: string): Metadata {
  const title = directive(content, "title") ?? directive(content, "t");
  const artist = directive(content, "artist") ?? directive(content, "a");
  const spotifyTrackId = directive(content, "spotify_track_id");
  const versionName = directive(content, "version");

  if (title && artist) {
    return { title, artist, spotifyTrackId, versionName };
  }

  const base = filename.replace(/\.[^.]+$/, "").replaceAll("/", "-");
  const dashIdx = base.indexOf(" - ");
  if (dashIdx > 0) {
    return {
      artist: artist ?? base.slice(0, dashIdx).trim(),
      title: title ?? base.slice(dashIdx + 3).trim(),
      spotifyTrackId,
      versionName
    };
  }
  return {
    title: title ?? base,
    artist: artist ?? "",
    spotifyTrackId,
    versionName
  };
}

function directive(content: string, name: string): string | undefined {
  const re = new RegExp(`\\{\\s*${name}\\s*:\\s*([^}]+)\\}`, "i");
  const m = content.match(re);
  return m ? m[1].trim() : undefined;
}
