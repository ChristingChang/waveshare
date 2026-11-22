import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { createSurfSession } from "./db";

vi.mock("./db", async importOriginal => ({
  ...await importOriginal<typeof import("./db")>(),
  createSurfSession: vi.fn().mockResolvedValue({ insertId: 1 }),
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
    expect(createSurfSession).toHaveBeenCalledWith({ userId: 1, ...newSession, videoUrl: "" }, []);
  });
});
