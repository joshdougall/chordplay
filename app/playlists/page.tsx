"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/Skeleton";

type Playlist = {
  id: string;
  name: string;
  description: string;
  images: { url: string }[];
  tracksTotal: number;
};

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/spotify/playlists")
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: { playlists: Playlist[] }) => setPlaylists(data.playlists))
      .catch(err => setError(`Failed to load playlists (${err})`))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex flex-col gap-4">
        <h1 className="text-xl font-semibold" style={{ color: "var(--ink)" }}>Playlists</h1>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded overflow-hidden" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
              <Skeleton style={{ width: "100%", aspectRatio: "1 / 1", borderRadius: 0 }} />
              <div className="p-3 flex flex-col gap-2">
                <Skeleton style={{ height: "0.875rem", width: "70%" }} />
                <Skeleton style={{ height: "0.75rem", width: "40%" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (error) {
    return <div className="p-8" style={{ color: "var(--danger)" }}>{error}</div>;
  }

  return (
    <div className="p-6 flex flex-col gap-4">
      <h1 className="text-xl font-semibold" style={{ color: "var(--ink)" }}>Playlists</h1>
      <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
        Pick a playlist to browse its tracks and batch-import chord sheets.
      </p>
      {playlists.length === 0 && (
        <div style={{ color: "var(--ink-muted)" }}>No playlists. Create one in Spotify and it&apos;ll show up here.</div>
      )}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
        {playlists.map(p => (
          <Link
            key={p.id}
            href={`/playlists/${p.id}`}
            className="rounded overflow-hidden transition-colors flex flex-col"
            style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}
          >
            {p.images?.[0]?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.images[0].url} alt="" className="w-full aspect-square object-cover" />
            ) : (
              <div className="w-full aspect-square flex items-center justify-center" style={{ backgroundColor: "var(--bg-alt)" }}>
                <span style={{ color: "var(--ink-faint)", fontSize: "2rem" }}>♪</span>
              </div>
            )}
            <div className="p-3 flex flex-col gap-1">
              <div className="font-medium text-sm truncate" style={{ color: "var(--ink)" }}>{p.name}</div>
              <div className="text-xs" style={{ color: "var(--ink-faint)" }}>{p.tracksTotal} tracks</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
