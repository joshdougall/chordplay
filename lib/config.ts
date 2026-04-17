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
  const buf = Buffer.from(secretB64, "base64");
  if (buf.length !== 32) {
    throw new ConfigError(`APP_SECRET must decode to exactly 32 bytes (got ${buf.length})`);
  }
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
