export type ScrapeOptions = {
  url: string;
  onlyMainContent?: boolean;
  formats?: Array<"markdown" | "html">;
  waitFor?: number; // ms to wait for JS-rendered content
};

export type ScrapeResult = {
  markdown?: string;
  html?: string;
  metadata?: { title?: string; description?: string; sourceURL?: string };
};

import { logger } from "@/lib/logger";

export async function firecrawlScrape(opts: ScrapeOptions): Promise<ScrapeResult | null> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return null;

  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      url: opts.url,
      onlyMainContent: opts.onlyMainContent ?? true,
      formats: opts.formats ?? ["markdown"],
      waitFor: opts.waitFor ?? 0,
    }),
  });
  if (!res.ok) {
    logger.warn({ url: opts.url, status: res.status }, "firecrawl scrape non-ok response");
    return null;
  }
  const text = await res.text();
  const bytes = text.length;
  const data = JSON.parse(text) as { success: boolean; data?: ScrapeResult };
  if (!data.success || !data.data) return null;
  logger.info({ url: opts.url, status: res.status, bytes }, "firecrawl scrape complete");
  return data.data;
}
