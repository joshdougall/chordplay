export function ConnectSpotify() {
  return (
    <div className="p-8 text-center">
      <p className="mb-4" style={{ color: "var(--ink-muted)" }}>Connect your Spotify account to get started.</p>
      <a
        href="/api/auth/login"
        className="inline-block px-4 py-2 rounded font-semibold transition-colors"
        style={{ backgroundColor: "var(--accent)", color: "var(--bg)" }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent-hover)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent)"; }}
      >
        Connect Spotify
      </a>
    </div>
  );
}
