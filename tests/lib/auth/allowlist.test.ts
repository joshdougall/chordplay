import { describe, it, expect } from "vitest";
import { isUserAllowed, parseAllowedUsers } from "@/lib/auth/allowlist";

describe("parseAllowedUsers", () => {
  it("returns an empty list when unset, which means 'no allowlist'", () => {
    expect(parseAllowedUsers(undefined)).toEqual([]);
    expect(parseAllowedUsers("")).toEqual([]);
    expect(parseAllowedUsers("   ")).toEqual([]);
  });

  it("splits and trims a comma-separated list", () => {
    expect(parseAllowedUsers(" josh , someone-else ")).toEqual(["josh", "someone-else"]);
  });
});

describe("isUserAllowed", () => {
  it("allows everyone when no allowlist is configured, so the OSS default is open", () => {
    expect(isUserAllowed("anybody", [])).toBe(true);
  });

  it("treats an absent list as no allowlist rather than throwing", () => {
    expect(isUserAllowed("anybody", undefined)).toBe(true);
  });

  it("allows a listed user", () => {
    expect(isUserAllowed("joshdougall", ["joshdougall", "guest"])).toBe(true);
  });

  it("REFUSES an unlisted user once a list exists", () => {
    expect(isUserAllowed("a-stranger", ["joshdougall"])).toBe(false);
  });

  it("compares case-insensitively, since Spotify ids are inconsistently cased", () => {
    expect(isUserAllowed("JoshDougall", ["joshdougall"])).toBe(true);
  });

  it("does not allow an empty userId to slip through a configured list", () => {
    expect(isUserAllowed("", ["joshdougall"])).toBe(false);
  });
});
