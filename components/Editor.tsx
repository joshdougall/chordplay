"use client";

import { useEffect, useState } from "react";

export function Editor({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: () => void }) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/library/${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error(await res.text());
        const { content: c } = await res.json();
        setContent(c);
      } catch (err) { setError((err as Error).message); }
      finally { setLoading(false); }
    })();
  }, [id]);

  async function save() {
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/library/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
      });
      if (!res.ok) throw new Error(await res.text());
      onSaved();
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="p-4" style={{ color: "var(--ink-muted)" }}>Loading…</div>;
  return (
    <div className="p-4 flex flex-col gap-3">
      <textarea
        className="p-2 rounded min-h-96"
        style={{
          backgroundColor: "var(--bg-surface)",
          color: "var(--ink)",
          fontFamily: "var(--font-mono-brand, monospace)",
          border: "1px solid var(--border)"
        }}
        value={content}
        onChange={e => setContent(e.target.value)}
      />
      {error && <div className="text-sm" style={{ color: "var(--danger)" }}>{error}</div>}
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded transition-colors disabled:opacity-50"
          style={{ backgroundColor: "var(--accent)", color: "var(--bg)" }}
          onMouseEnter={e => { if (!saving) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent-hover)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent)"; }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded transition-colors"
          style={{ backgroundColor: "var(--bg-surface)", color: "var(--ink-muted)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-alt)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-surface)"; }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
