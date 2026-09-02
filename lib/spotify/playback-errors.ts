/**
 * Turn a Spotify playback response status into something worth showing.
 *
 * Every branch of /api/spotify/playback used to return {ok:true} with status
 * 200 unless the upstream status was exactly 403. A 404 NO_ACTIVE_DEVICE — by
 * far the most common failure, since Spotify refuses playback commands with no
 * active device — therefore looked like success. Pressing play did nothing and
 * the app said nothing, so the only available response was to press it again.
 */
export type PlaybackError = { status: number; message: string };

export function playbackErrorFor(status: number): PlaybackError | null {
  if (status >= 200 && status < 300) return null;

  switch (status) {
    case 404:
      return {
        status,
        message: "No active Spotify device. Start playback on a phone, speaker or the Spotify app, then try again.",
      };
    case 403:
      return {
        status,
        message: "Spotify refused that: missing permission, or it needs Premium.",
      };
    case 429:
      return {
        status,
        message: "Too many requests to Spotify just now. Slow down and retry in a moment.",
      };
    case 401:
      return { status, message: "Spotify session expired. Reconnect your account." };
    default:
      return { status, message: `Spotify returned ${status}.` };
  }
}
