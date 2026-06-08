import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize chordsheetjs HtmlDivFormatter output before injecting via
 * dangerouslySetInnerHTML. chordsheetjs does NOT escape lyric/comment text,
 * so library or externally-scraped content can carry <script>/onerror payloads.
 * DOMPurify's defaults preserve the div/span structure and `class` attributes
 * (needed for the `.chord` click handler) while stripping scripts, event
 * handlers, and javascript: URLs.
 */
export function sanitizeChordHtml(html: string): string {
  return DOMPurify.sanitize(html);
}
