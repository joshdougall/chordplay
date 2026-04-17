"use client";

import { useMemo } from "react";
import { ChordProParser, HtmlDivFormatter } from "chordsheetjs";

export function ChordProView({ source, transpose = 0 }: { source: string; transpose?: number }) {
  const html = useMemo(() => {
    try {
      const song = new ChordProParser().parse(source);
      const transposed = transpose ? song.transpose(transpose) : song;
      return new HtmlDivFormatter().format(transposed);
    } catch (err) {
      return `<pre class="text-red-400">Parse error: ${(err as Error).message}</pre><pre>${escape(source)}</pre>`;
    }
  }, [source, transpose]);
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
