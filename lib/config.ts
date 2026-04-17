export class ConfigError extends Error {}

export type Config = {
  appSecret: Buffer;
  spotifyClientId: string;
  spotifyClientSecret: string;
  spotifyRedirectUri: string;
  libraryPath: string;
  dataPath: string;
  logLevel: "debug" | "info" | "warn" | "error";
};

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new ConfigError(`Missing required env var: ${name}`);
  return v;
}

export function loadConfig(): Config {
  const secretB64 = required("APP_SECRET");
  const decoded = Buffer.from(secretB64, "base64");
  if (decoded.length < 32) {
    throw new ConfigError(`APP_SECRET must decode to at least 32 bytes (got ${decoded.length})`);
  }
  const buf = decoded.subarray(0, 32);
  const level = (process.env.LOG_LEVEL ?? "info") as Config["logLevel"];
  return {
    appSecret: buf,
    spotifyClientId: required("SPOTIFY_CLIENT_ID"),
    spotifyClientSecret: required("SPOTIFY_CLIENT_SECRET"),
    spotifyRedirectUri: required("SPOTIFY_REDIRECT_URI"),
    libraryPath: required("LIBRARY_PATH"),
    dataPath: required("DATA_PATH"),
    logLevel: ["debug", "info", "warn", "error"].includes(level) ? level : "info"
  };
}

let cached: Config | null = null;
export function getConfig(): Config {
  if (!cached) cached = loadConfig();
  return cached;
}
