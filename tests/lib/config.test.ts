import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig, ConfigError } from "@/lib/config";

const REQUIRED = {
  APP_SECRET: Buffer.alloc(32).toString("base64"), // exactly 32 zero bytes, base64 encoded
  SPOTIFY_CLIENT_ID: "cid",
  SPOTIFY_CLIENT_SECRET: "csec",
  SPOTIFY_REDIRECT_URI: "https://chords.dougall.ca/api/auth/callback",
  LIBRARY_PATH: "/tmp/lib",
  DATA_PATH: "/tmp/data"
};

describe("loadConfig", () => {
  const original = { ...process.env };
  beforeEach(() => {
    for (const k of Object.keys(REQUIRED)) delete process.env[k];
  });
  afterEach(() => { process.env = { ...original }; });

  it("loads valid env", () => {
    Object.assign(process.env, REQUIRED);
    const cfg = loadConfig();
    expect(cfg.spotifyClientId).toBe("cid");
    expect(cfg.libraryPath).toBe("/tmp/lib");
    expect(cfg.appSecret).toBeInstanceOf(Buffer);
    expect(cfg.appSecret.length).toBe(32);
  });

  it("throws on missing var", () => {
    Object.assign(process.env, REQUIRED);
    delete process.env.SPOTIFY_CLIENT_ID;
    expect(() => loadConfig()).toThrow(ConfigError);
  });

  it("throws on invalid APP_SECRET length", () => {
    Object.assign(process.env, REQUIRED, { APP_SECRET: "short" });
    expect(() => loadConfig()).toThrow(/APP_SECRET/);
  });
});
