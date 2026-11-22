import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { createSurfSession, getSessionById, getSessionShareIds, getSessionsSharedWithUser, setSessionShares } from "./db";

vi.mock("./db", async importOriginal => ({
  ...await importOriginal<typeof import("./db")>(),
  createSurfSession: vi.fn().mockResolvedValue({ insertId: 1 }),
  getSessionById: vi.fn(), getSessionShareIds: vi.fn(),
  getSessionsSharedWithUser: vi.fn(), setSessionShares: vi.fn(),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "google",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("surfSessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionById).mockResolvedValue(undefined);
    vi.mocked(getSessionsSharedWithUser).mockResolvedValue([]);
  });

  const record = { id: 7, userId: 1, date: "2026-11-22", spotName: "烏石港", videoUrl: "private", videoPath: "private", waveQuality: 4 };

  it("returns the owner's record with ownership metadata", async () => {
    vi.mocked(getSessionById).mockResolvedValue(record as never);
    const caller = appRouter.createCaller(createAuthContext().ctx);
    expect(await caller.surfSessions.getById({ id: 7 })).toMatchObject({ isOwner: true, ownerName: "Test User", videoUrl: "/api/videos/7" });
  });

  it("returns a shared friend's read-only record but nothing to a stranger", async () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    vi.mocked(getSessionsSharedWithUser).mockResolvedValueOnce([{ ...record, userId: 2, ownerName: "浪友", videoUrl: "/api/videos/7" }] as never);
    expect(await caller.surfSessions.getById({ id: 7 })).toMatchObject({ isOwner: false, ownerName: "浪友", videoUrl: "/api/videos/7" });
    expect(getSessionsSharedWithUser).toHaveBeenCalledWith(1, 7);
    expect(await caller.surfSessions.getById({ id: 7 })).toBeUndefined();
  });

  it("lists records shared with the current user, including an empty list", async () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    const records = [{ ...record, ownerName: "浪友", videoUrl: "/api/videos/7" }];
    vi.mocked(getSessionsSharedWithUser).mockResolvedValueOnce(records as never);
    expect(await caller.surfSessions.getSharedWithMe()).toEqual(records);
    expect(getSessionsSharedWithUser).toHaveBeenCalledWith(1);
    expect(await caller.surfSessions.getSharedWithMe()).toEqual([]);
  });

  it("only lets the owner read or replace shares", async () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    await expect(caller.surfSessions.getShares({ id: 7 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.surfSessions.setShares({ id: 7, friendIds: [2] })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(setSessionShares).not.toHaveBeenCalled();
    vi.mocked(getSessionById).mockResolvedValue(record as never);
    vi.mocked(getSessionShareIds).mockResolvedValue([2]);
    vi.mocked(setSessionShares).mockResolvedValue([]);
    expect(await caller.surfSessions.getShares({ id: 7 })).toEqual([2]);
    expect(await caller.surfSessions.setShares({ id: 7, friendIds: [] })).toEqual([]);
    expect(setSessionShares).toHaveBeenCalledWith(7, 1, []);
  });

  it("propagates sharing errors", async () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    vi.mocked(getSessionById).mockResolvedValue(record as never);
    vi.mocked(setSessionShares).mockRejectedValueOnce(new Error("query failed"));
    await expect(caller.surfSessions.setShares({ id: 7, friendIds: [2] })).rejects.toThrow("query failed");
  });
  it("should get user stats", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const stats = await caller.surfSessions.getStats();

    expect(stats).toBeDefined();
    expect(stats).toHaveProperty("totalSessions");
    expect(stats).toHaveProperty("uniqueSpots");
    expect(stats).toHaveProperty("avgWaveQuality");
    expect(typeof stats.totalSessions).toBe("number");
  });

  it("should get recent sessions", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const sessions = await caller.surfSessions.getRecent();

    expect(Array.isArray(sessions)).toBe(true);
    expect(sessions.length).toBeLessThanOrEqual(3);
  });

  it("should get all sessions", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const sessions = await caller.surfSessions.getAll();

    expect(Array.isArray(sessions)).toBe(true);
  });

  it("should get sessions by date range", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const startDate = "2025-01-01";
    const endDate = "2025-12-31";

    const sessions = await caller.surfSessions.getByDateRange({
      startDate,
      endDate,
    });

    expect(Array.isArray(sessions)).toBe(true);
  });

  it("should get spot names for autocomplete", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const spotNames = await caller.surfSessions.getSpotNames();

    expect(Array.isArray(spotNames)).toBe(true);
  });

  it("should create a new session", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const newSession = {
      date: "2025-11-21",
      spotName: "測試浪點",
      videoPath: "r2/surf-videos/1/video-123-0123456789abcdef.mp4",
      waveQuality: 4,
      boardType: "6'2 Shortboard",
      note: "測試心得",
    };

    const result = await caller.surfSessions.create(newSession);

    expect(result).toBeDefined();
    expect(createSurfSession).toHaveBeenCalledWith({ userId: 1, ...newSession, videoUrl: "", conditions: null }, []);
  });
});
