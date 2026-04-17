"use client";

import type { NowPlaying } from "@/lib/spotify/now-playing-cache";

type Props = {
  data: NowPlaying;
  isLastPlayed?: boolean;
  lastPlayedAt?: string;
};

export function NowPlayingHeader({ data, isLastPlayed, lastPlayedAt }: Props) {
  if (!data) return <div className="p-4" style={{ color: "var(--ink-muted)" }}>Waiting for playback…</div>;
  return (
    <div className="flex items-center gap-4 p-4" style={{ borderBottom: "1px solid var(--border)" }}>
      {data.albumArt && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data.albumArt} alt="" className="w-14 h-14 rounded" />
      )}
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate" style={{ color: "var(--ink)" }}>{data.title}</div>
        <div className="text-sm truncate" style={{ color: "var(--ink-muted)" }}>{data.artists.join(", ")}</div>
        {isLastPlayed && (
          <div className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>
            Last played {lastPlayedAt ? formatRelativeTime(lastPlayedAt) : "recently"}
          </div>
        )}
      </div>
      {!isLastPlayed && (
        <div className="text-sm" style={{ color: "var(--ink-faint)" }}>
          {formatMs(data.progressMs)} / {formatMs(data.durationMs)}
        </div>
      )}
    </div>
  );
}

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
