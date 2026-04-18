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
  if (!res.ok) return null;
  const data = (await res.json()) as { success: boolean; data?: ScrapeResult };
  if (!data.success || !data.data) return null;
  return data.data;
}
