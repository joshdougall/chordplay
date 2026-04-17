"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Tab = { href: string; label: string; match: (path: string) => boolean };

const TABS: Tab[] = [
  { href: "/", label: "Now Playing", match: p => p === "/" },
  { href: "/library", label: "Library", match: p => p === "/library" || p.startsWith("/library/") },
  { href: "/add", label: "Add", match: p => p === "/add" },
  { href: "/settings", label: "Settings", match: p => p === "/settings" }
];

export function Header() {
  const path = usePathname();
  const [auth, setAuth] = useState<{ authenticated: boolean; userId?: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/status")
      .then(r => r.json())
      .then(setAuth)
      .catch(() => setAuth({ authenticated: false }));
  }, [path]); // re-check on nav (e.g. after login redirect)

  const authed = auth?.authenticated;

  return (
    <header className="flex items-center gap-6 px-4 py-3 border-b border-neutral-800 bg-neutral-950">
      <Link href="/" className="text-lg font-semibold tracking-tight">Chordplay</Link>
      {authed && (
        <nav className="flex gap-1 text-sm">
          {TABS.map(t => {
            const active = t.match(path);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`px-3 py-1.5 rounded ${active ? "bg-neutral-800 text-neutral-100" : "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900"}`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      )}
      <div className="ml-auto flex items-center gap-3 text-sm">
        {authed && auth?.userId && (
          <span className="text-neutral-500">{auth.userId}</span>
        )}
        {authed && (
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="text-neutral-500 hover:text-neutral-200">Logout</button>
          </form>
        )}
      </div>
    </header>
  );
}
