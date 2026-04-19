"use client";

import { useEffect, useState } from "react";

type EventRow = {
  id: number;
  ts: number;
  user_id: string;
  kind: string;
  payload: unknown;
};

type Stats = {
  byUser: Array<{ user_id: string; count: number }>;
  byKind: Array<{ kind: string; count: number }>;
  topTracks: Array<{ title: string; artist: string; count: number }>;
  matchRate: { hit: number; miss: number; rate: number };
};

type UsageResponse = {
  events: EventRow[];
  stats: Stats;
};

type TabId = "overview" | "events" | "export";

const KINDS = ["play", "match", "save", "edit", "delete", "transpose", "error"] as const;

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleString();
}

function payloadSummary(payload: unknown): string {
  if (!payload || typeof payload !== "object") return String(payload ?? "");
  const p = payload as Record<string, unknown>;
  if (p.title) return `${p.title}${p.artist ? ` — ${p.artist}` : ""}`;
  if (p.trackId) return `track:${p.trackId}`;
  if (p.id) return String(p.id);
  if (p.msg) return String(p.msg);
  const keys = Object.keys(p);
  return keys.slice(0, 2).map(k => `${k}:${p[k]}`).join(", ");
}

const cardStyle = {
  backgroundColor: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: "6px",
  padding: "1rem",
};

export default function AdminPage() {
  const [tab, setTab] = useState<TabId>("overview");
  const [data, setData] = useState<UsageResponse | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // Filters for events tab
  const [filterUser, setFilterUser] = useState("");
  const [filterKind, setFilterKind] = useState("");
  const [sinceHours, setSinceHours] = useState(24);
  const [offset, setOffset] = useState(0);
  const LIMIT = 100;

  async function fetchData() {
    setLoading(true);
    try {
      const since = Date.now() - sinceHours * 60 * 60 * 1000;
      const url = new URL("/api/admin/usage", window.location.origin);
      url.searchParams.set("since", String(since));
      url.searchParams.set("limit", String(LIMIT));
      url.searchParams.set("offset", String(offset));
      if (filterUser) url.searchParams.set("userId", filterUser);
      if (filterKind) url.searchParams.set("kind", filterKind);
      const res = await fetch(url);
      if (res.status === 403) { setForbidden(true); return; }
      const json = (await res.json()) as UsageResponse;
      setData(json);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, [sinceHours, filterUser, filterKind, offset]); // eslint-disable-line react-hooks/exhaustive-deps

  function exportUrl(): string {
    const since = Date.now() - sinceHours * 60 * 60 * 1000;
    const url = new URL("/api/admin/usage/export", window.location.origin);
    url.searchParams.set("since", String(since));
    if (filterUser) url.searchParams.set("userId", filterUser);
    if (filterKind) url.searchParams.set("kind", filterKind);
    return url.toString();
  }

  if (forbidden) {
    return (
      <div className="p-6 max-w-2xl">
        <div className="rounded p-6 text-center" style={cardStyle}>
          <p style={{ color: "var(--danger)" }} className="text-sm">Not an admin.</p>
          <p className="text-xs mt-2" style={{ color: "var(--ink-faint)" }}>
            Set <code>CHORDPLAY_ADMIN_USERS</code> in the deployment environment to grant access.
          </p>
        </div>
      </div>
    );
  }

  const tabBtn = (id: TabId, label: string) => (
    <button
      onClick={() => setTab(id)}
      className="px-4 py-2 rounded text-sm transition-colors"
      style={
        tab === id
          ? { backgroundColor: "var(--accent)", color: "var(--bg)" }
          : { backgroundColor: "var(--bg-alt)", color: "var(--ink-muted)", border: "1px solid var(--border)" }
      }
    >
      {label}
    </button>
  );

  const stats = data?.stats;
  const events = data?.events ?? [];

  return (
    <div className="p-6 max-w-4xl flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold" style={{ color: "var(--ink)" }}>Usage Admin</h1>
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-3 py-1.5 rounded text-sm disabled:opacity-50"
          style={{ backgroundColor: "var(--bg-alt)", color: "var(--ink-muted)", border: "1px solid var(--border)" }}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* Time range selector */}
      <div className="flex items-center gap-2 text-sm" style={{ color: "var(--ink-muted)" }}>
        <span>Show last</span>
        {([1, 6, 24, 72, 168] as const).map(h => (
          <button
            key={h}
            onClick={() => { setSinceHours(h); setOffset(0); }}
            className="px-2 py-0.5 rounded text-xs"
            style={sinceHours === h
              ? { backgroundColor: "var(--accent)", color: "var(--bg)" }
              : { backgroundColor: "var(--bg-alt)", color: "var(--ink-muted)", border: "1px solid var(--border)" }
            }
          >
            {h === 1 ? "1h" : h === 6 ? "6h" : h === 24 ? "24h" : h === 72 ? "3d" : "7d"}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabBtn("overview", "Overview")}
        {tabBtn("events", "Events")}
        {tabBtn("export", "Export")}
      </div>

      {/* Overview tab */}
      {tab === "overview" && stats && (
        <div className="flex flex-col gap-4">
          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div style={cardStyle} className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>Plays</span>
              <span className="text-2xl font-semibold tabular-nums" style={{ color: "var(--ink)" }}>
                {stats.byKind.find(k => k.kind === "play")?.count ?? 0}
              </span>
            </div>
            <div style={cardStyle} className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>Active users</span>
              <span className="text-2xl font-semibold tabular-nums" style={{ color: "var(--ink)" }}>
                {stats.byUser.length}
              </span>
            </div>
            <div style={cardStyle} className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>Match rate</span>
              <span className="text-2xl font-semibold tabular-nums" style={{ color: "var(--ink)" }}>
                {stats.matchRate.hit + stats.matchRate.miss > 0
                  ? `${Math.round(stats.matchRate.rate * 100)}%`
                  : "—"}
              </span>
              <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
                {stats.matchRate.hit}h / {stats.matchRate.miss}m
              </span>
            </div>
            <div style={cardStyle} className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>Errors</span>
              <span className="text-2xl font-semibold tabular-nums" style={{ color: stats.byKind.find(k => k.kind === "error")?.count ? "var(--danger)" : "var(--ink)" }}>
                {stats.byKind.find(k => k.kind === "error")?.count ?? 0}
              </span>
            </div>
          </div>

          {/* Events by kind */}
          <div className="grid md:grid-cols-2 gap-4">
            <div style={cardStyle} className="flex flex-col gap-2">
              <h3 className="text-xs uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>Events by kind</h3>
              {stats.byKind.length === 0
                ? <span className="text-sm" style={{ color: "var(--ink-faint)" }}>No data</span>
                : stats.byKind.map(k => (
                  <div key={k.kind} className="flex items-center justify-between text-sm">
                    <span className="font-mono" style={{ color: "var(--ink-muted)" }}>{k.kind}</span>
                    <span className="tabular-nums" style={{ color: "var(--ink)" }}>{k.count}</span>
                  </div>
                ))
              }
            </div>
            <div style={cardStyle} className="flex flex-col gap-2">
              <h3 className="text-xs uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>By user</h3>
              {stats.byUser.length === 0
                ? <span className="text-sm" style={{ color: "var(--ink-faint)" }}>No data</span>
                : stats.byUser.map(u => (
                  <div key={u.user_id} className="flex items-center justify-between text-sm">
                    <span className="font-mono" style={{ color: "var(--ink-muted)" }}>{u.user_id}</span>
                    <span className="tabular-nums" style={{ color: "var(--ink)" }}>{u.count}</span>
                  </div>
                ))
              }
            </div>
          </div>

          {/* Top tracks */}
          {stats.topTracks.length > 0 && (
            <div style={cardStyle} className="flex flex-col gap-2">
              <h3 className="text-xs uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>Top tracks played</h3>
              {stats.topTracks.slice(0, 10).map((t, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span style={{ color: "var(--ink-muted)" }}>
                    {t.title}
                    {t.artist ? <span style={{ color: "var(--ink-faint)" }}> — {t.artist}</span> : null}
                  </span>
                  <span className="tabular-nums ml-4 shrink-0" style={{ color: "var(--ink)" }}>{t.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Events tab */}
      {tab === "events" && (
        <div className="flex flex-col gap-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 text-sm items-center">
            <input
              type="text"
              placeholder="Filter by user"
              value={filterUser}
              onChange={e => { setFilterUser(e.target.value); setOffset(0); }}
              className="px-2 py-1 rounded text-sm"
              style={{ backgroundColor: "var(--bg-alt)", color: "var(--ink)", border: "1px solid var(--border)", width: "160px" }}
            />
            <select
              value={filterKind}
              onChange={e => { setFilterKind(e.target.value); setOffset(0); }}
              className="px-2 py-1 rounded text-sm"
              style={{ backgroundColor: "var(--bg-alt)", color: "var(--ink)", border: "1px solid var(--border)" }}
            >
              <option value="">All kinds</option>
              {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            {(filterUser || filterKind) && (
              <button
                onClick={() => { setFilterUser(""); setFilterKind(""); setOffset(0); }}
                className="px-2 py-1 rounded text-xs"
                style={{ color: "var(--ink-faint)", border: "1px solid var(--border)" }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Table */}
          <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-alt)" }}>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>Time</th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>User</th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>Kind</th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>Payload</th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-xs" style={{ color: "var(--ink-faint)" }}>No events found.</td>
                  </tr>
                )}
                {events.map(e => (
                  <>
                    <tr
                      key={e.id}
                      onClick={() => setExpandedRow(expandedRow === e.id ? null : e.id)}
                      className="cursor-pointer transition-colors"
                      style={{ borderBottom: "1px solid var(--border)" }}
                      onMouseEnter={el => { (el.currentTarget as HTMLTableRowElement).style.backgroundColor = "var(--bg-alt)"; }}
                      onMouseLeave={el => { (el.currentTarget as HTMLTableRowElement).style.backgroundColor = ""; }}
                    >
                      <td className="px-3 py-2 font-mono text-xs whitespace-nowrap" style={{ color: "var(--ink-faint)" }}>{fmtTime(e.ts)}</td>
                      <td className="px-3 py-2 font-mono text-xs" style={{ color: "var(--ink-muted)" }}>{e.user_id}</td>
                      <td className="px-3 py-2">
                        <span
                          className="px-1.5 py-0.5 rounded text-xs font-mono"
                          style={{
                            backgroundColor: "var(--bg-alt)",
                            color: e.kind === "error" ? "var(--danger)" : "var(--accent)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          {e.kind}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs" style={{ color: "var(--ink-muted)" }}>{payloadSummary(e.payload)}</td>
                    </tr>
                    {expandedRow === e.id && (
                      <tr key={`${e.id}-expanded`} style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-alt)" }}>
                        <td colSpan={4} className="px-3 py-2">
                          <pre className="text-xs overflow-auto whitespace-pre-wrap" style={{ color: "var(--ink-muted)", maxHeight: "200px" }}>
                            {JSON.stringify(e.payload, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center gap-3 text-sm" style={{ color: "var(--ink-muted)" }}>
            <button
              onClick={() => setOffset(Math.max(0, offset - LIMIT))}
              disabled={offset === 0}
              className="px-3 py-1.5 rounded disabled:opacity-40"
              style={{ backgroundColor: "var(--bg-alt)", border: "1px solid var(--border)", color: "var(--ink-muted)" }}
            >
              Previous
            </button>
            <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
              {offset + 1}–{offset + events.length}
            </span>
            <button
              onClick={() => setOffset(offset + LIMIT)}
              disabled={events.length < LIMIT}
              className="px-3 py-1.5 rounded disabled:opacity-40"
              style={{ backgroundColor: "var(--bg-alt)", border: "1px solid var(--border)", color: "var(--ink-muted)" }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Export tab */}
      {tab === "export" && (
        <div style={cardStyle} className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
            Download a CSV of all events matching the current time range and filters.
          </p>
          <div className="flex gap-2 items-center text-sm" style={{ color: "var(--ink-faint)" }}>
            <span>Range: last {sinceHours}h</span>
            {filterUser && <span>User: {filterUser}</span>}
            {filterKind && <span>Kind: {filterKind}</span>}
          </div>
          <a
            href={exportUrl()}
            download
            className="inline-block px-4 py-2 rounded text-sm w-fit"
            style={{ backgroundColor: "var(--accent)", color: "var(--bg)" }}
          >
            Download CSV
          </a>
        </div>
      )}
    </div>
  );
}
