"use client";

import type { NowPlaying } from "@/lib/spotify/now-playing-cache";

export function NowPlayingHeader({ data }: { data: NowPlaying }) {
  if (!data) return <div className="p-4 text-neutral-400">Waiting for playback…</div>;
  return (
    <div className="flex items-center gap-4 p-4 border-b border-neutral-800">
      {data.albumArt && (
        <img src={data.albumArt} alt="" className="w-14 h-14 rounded" />
      )}
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">{data.title}</div>
        <div className="text-sm text-neutral-400 truncate">{data.artists.join(", ")}</div>
      </div>
      <div className="text-sm text-neutral-500">
        {formatMs(data.progressMs)} / {formatMs(data.durationMs)}
      </div>
    </div>
  );
}

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
