"use client";

import { useMemo } from "react";
import { ChordProParser, HtmlDivFormatter } from "chordsheetjs";

export function ChordProView({ source }: { source: string }) {
  const html = useMemo(() => {
    try {
      const song = new ChordProParser().parse(source);
      return new HtmlDivFormatter().format(song);
    } catch (err) {
      return `<pre class="text-red-400">Parse error: ${(err as Error).message}</pre><pre>${escape(source)}</pre>`;
    }
  }, [source]);
  return (
    <div
      className="chordpro prose prose-invert max-w-none font-mono"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function escape(s: string): string {
  return s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}
