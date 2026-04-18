import { logger } from "@/lib/logger";

type FsRequest = {
  cmd: "request.get";
  url: string;
  maxTimeout?: number; // ms, default 60000
};

type FsResponse = {
  status: "ok" | "error";
  message?: string;
  solution?: {
    url: string;
    status: number;
    response: string; // HTML
    userAgent: string;
    cookies: Array<{ name: string; value: string }>;
    headers: Record<string, string>;
  };
};

const DEFAULT_TIMEOUT = 60_000;

export async function flaresolverrFetch(url: string): Promise<string | null> {
  const endpoint = process.env.FLARESOLVERR_URL;
  if (!endpoint) return null;

  const body: FsRequest = { cmd: "request.get", url, maxTimeout: DEFAULT_TIMEOUT };
  try {
    const res = await fetch(`${endpoint}/v1`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      logger.warn({ url, status: res.status }, "flaresolverr bad response");
      return null;
    }
    const data = (await res.json()) as FsResponse;
    if (data.status !== "ok" || !data.solution) {
      logger.warn({ url, status: data.status, message: data.message }, "flaresolverr failed");
      return null;
    }
    logger.info(
      { url, status: data.solution.status, bytes: data.solution.response.length },
      "flaresolverr fetched"
    );
    return data.solution.response;
  } catch (err) {
    logger.warn({ url, error: (err as Error).message }, "flaresolverr fetch error");
    return null;
  }
}
