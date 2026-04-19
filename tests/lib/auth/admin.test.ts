import { describe, it, expect, vi, beforeEach } from "vitest";

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns null when no session", async () => {
    vi.doMock("@/lib/auth/session", () => ({ getSession: async () => null }));
    vi.doMock("@/lib/config", () => ({ getConfig: () => ({ adminUserIds: ["joshdougall"] }) }));
    const { requireAdmin } = await import("@/lib/auth/admin");
    const result = await requireAdmin();
    expect(result).toBeNull();
  });

  it("returns null when userId not in adminUserIds", async () => {
    vi.doMock("@/lib/auth/session", () => ({ getSession: async () => ({ userId: "regularuser" }) }));
    vi.doMock("@/lib/config", () => ({ getConfig: () => ({ adminUserIds: ["joshdougall"] }) }));
    const { requireAdmin } = await import("@/lib/auth/admin");
    const result = await requireAdmin();
    expect(result).toBeNull();
  });

  it("returns userId when user is in adminUserIds", async () => {
    vi.doMock("@/lib/auth/session", () => ({ getSession: async () => ({ userId: "joshdougall" }) }));
    vi.doMock("@/lib/config", () => ({ getConfig: () => ({ adminUserIds: ["joshdougall"] }) }));
    const { requireAdmin } = await import("@/lib/auth/admin");
    const result = await requireAdmin();
    expect(result).toEqual({ userId: "joshdougall" });
  });

  it("supports multiple admins", async () => {
    vi.doMock("@/lib/auth/session", () => ({ getSession: async () => ({ userId: "secondadmin" }) }));
    vi.doMock("@/lib/config", () => ({ getConfig: () => ({ adminUserIds: ["joshdougall", "secondadmin"] }) }));
    const { requireAdmin } = await import("@/lib/auth/admin");
    const result = await requireAdmin();
    expect(result).toEqual({ userId: "secondadmin" });
  });

  it("returns null when adminUserIds is empty", async () => {
    vi.doMock("@/lib/auth/session", () => ({ getSession: async () => ({ userId: "joshdougall" }) }));
    vi.doMock("@/lib/config", () => ({ getConfig: () => ({ adminUserIds: [] }) }));
    const { requireAdmin } = await import("@/lib/auth/admin");
    const result = await requireAdmin();
    expect(result).toBeNull();
  });
});
