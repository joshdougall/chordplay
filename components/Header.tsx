"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ReportIssueButton } from "@/components/ReportIssueButton";

type Tab = { href: string; label: string; match: (path: string) => boolean };

const TABS: Tab[] = [
  { href: "/", label: "Now Playing", match: p => p === "/" },
  { href: "/library", label: "Library", match: p => p === "/library" || p.startsWith("/library/") },
  { href: "/add", label: "Add", match: p => p === "/add" },
  { href: "/settings", label: "Settings", match: p => p === "/settings" }
];

function ChordGlyph({ size = 24 }: { size?: number }) {
  // 4x6 fret grid with three dots representing a chord shape
  const frets = 4;
  const strings = 4;
  const w = size;
  const h = size;
  const padX = 3;
  const padY = 3;
  const gridW = w - padX * 2;
  const gridH = h - padY * 2;
  const colGap = gridW / (strings - 1);
  const rowGap = gridH / (frets - 1);

  // Lines
  const hLines = Array.from({ length: frets }, (_, i) => ({
    y: padY + i * rowGap
  }));
  const vLines = Array.from({ length: strings }, (_, i) => ({
    x: padX + i * colGap
  }));

  // Dots: a simple shape — strings 0,1,2 on frets 1,2,1
  const dots = [
    { s: 0, f: 1 },
    { s: 1, f: 2 },
    { s: 2, f: 1 }
  ];

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="currentColor" aria-hidden="true">
      {hLines.map((l, i) => (
        <line key={i} x1={padX} y1={l.y} x2={padX + gridW} y2={l.y} stroke="currentColor" strokeWidth="0.75" opacity="0.7" />
      ))}
      {vLines.map((l, i) => (
        <line key={i} x1={l.x} y1={padY} x2={l.x} y2={padY + gridH} stroke="currentColor" strokeWidth="0.75" opacity="0.7" />
      ))}
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={padX + d.s * colGap}
          cy={padY + d.f * rowGap}
          r={2}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}

export function Header() {
  const path = usePathname();
  const [auth, setAuth] = useState<{ authenticated: boolean; userId?: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/status")
      .then(r => r.json())
      .then(setAuth)
      .catch(() => setAuth({ authenticated: false }));
  }, [path]);

  const authed = auth?.authenticated;

  return (
    <header
      className="flex items-center gap-6 px-4 py-3"
      style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg)" }}
    >
      <Link href="/" className="flex items-center gap-2" style={{ color: "var(--accent)" }}>
        <ChordGlyph size={22} />
        <span className="brand-title text-lg tracking-tight" style={{ color: "var(--ink)" }}>Chordplay</span>
      </Link>
      {authed && (
        <nav className="flex gap-1 text-sm">
          {TABS.map(t => {
            const active = t.match(path);
            return (
              <Link
                key={t.href}
                href={t.href}
                className="px-3 py-1.5 rounded transition-colors"
                style={
                  active
                    ? {
                        backgroundColor: "var(--bg-alt)",
                        color: "var(--ink)",
                        borderBottom: "2px solid var(--accent)",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.4)"
                      }
                    : { color: "var(--ink-muted)" }
                }
                onMouseEnter={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.color = "var(--ink)";
                    (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-alt)";
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.color = "var(--ink-muted)";
                    (e.currentTarget as HTMLElement).style.backgroundColor = "";
                  }
                }}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      )}
      <div className="ml-auto flex items-center gap-3 text-sm">
        {authed && auth?.userId && (
          <span style={{ color: "var(--ink-faint)" }}>{auth.userId}</span>
        )}
        {authed && <ReportIssueButton />}
        {authed && (
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              style={{ color: "var(--ink-faint)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--ink-muted)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--ink-faint)"; }}
            >
              Logout
            </button>
          </form>
        )}
      </div>
    </header>
  );
}
