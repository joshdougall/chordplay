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

  if (loading) return <div className="p-4 text-neutral-400">Loading…</div>;
  return (
    <div className="p-4 flex flex-col gap-3">
      <textarea
        className="bg-neutral-900 p-2 rounded font-mono min-h-96"
        value={content}
        onChange={e => setContent(e.target.value)}
      />
      {error && <div className="text-red-400 text-sm">{error}</div>}
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="px-4 py-2 rounded bg-green-600 hover:bg-green-500 disabled:opacity-50">
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={onClose} className="px-4 py-2 rounded bg-neutral-800 hover:bg-neutral-700">Cancel</button>
      </div>
    </div>
  );
}
