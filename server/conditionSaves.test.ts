import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { createSurfSession, getSessionById, updateSurfSession } from "./db";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  createSurfSession: vi.fn().mockResolvedValue([{ insertId: 1 }]),
  getSessionById: vi.fn(),
  getSessionPhotos: vi.fn(),
  changeSessionPhotos: vi.fn(),
  updateSurfSession: vi.fn().mockResolvedValue({ affectedRows: 1 }),
}));
const caller = appRouter.createCaller({
  user: { id: 1 },
  req: {},
  res: {},
} as TrpcContext);
const record = {
  id: 1,
  userId: 1,
  date: "2026-11-21",
  spotName: "烏石港（北堤）",
  surfHour: null,
  spotLat: null,
  spotLng: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
  vi.mocked(getSessionById).mockResolvedValue(record as never);
});
afterEach(() => vi.unstubAllGlobals());
describe("condition saves", () => {
  it("still inserts a log with null conditions when every provider fails", async () => {
    await expect(
      caller.surfSessions.create({
        date: record.date,
        spotName: record.spotName,
        surfHour: 7,
        waveQuality: 4,
      })
    ).resolves.toEqual([{ insertId: 1 }]);
    expect(createSurfSession).toHaveBeenCalledWith(
      expect.objectContaining({ surfHour: 7, conditions: null }),
      []
    );
  });
  it("saves unknown locations with no network request", async () => {
    await caller.surfSessions.create({
      date: record.date,
      spotName: "未知",
      waveQuality: 4,
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(createSurfSession).toHaveBeenCalledWith(
      expect.objectContaining({ conditions: null }),
      []
    );
  });
  it.each([
    { date: "2026-11-20" },
    { spotName: "金山" },
    { spotLat: "24.5" },
    { spotLng: "121.5" },
    { surfHour: 7 },
    { surfHour: null },
  ])("refetches when condition fields change: %j", async change => {
    vi.mocked(getSessionById).mockResolvedValue({
      ...record,
      surfHour: 6,
    } as never);
    await caller.surfSessions.update({ id: 1, ...change });
    expect(fetch).toHaveBeenCalled();
    expect(updateSurfSession).toHaveBeenCalledWith(
      1,
      1,
      expect.objectContaining({ ...change, conditions: null })
    );
  });
  it("does not refetch unchanged conditions or note-only edits", async () => {
    await caller.surfSessions.update({
      id: 1,
      date: record.date,
      surfHour: null,
    });
    await caller.surfSessions.update({ id: 1, note: "心得" });
    expect(fetch).not.toHaveBeenCalled();
    expect(updateSurfSession).toHaveBeenLastCalledWith(1, 1, { note: "心得" });
  });
  it("does not fetch or update another user's log and rejects invalid hours", async () => {
    vi.mocked(getSessionById).mockResolvedValue(undefined);
    await expect(
      caller.surfSessions.update({ id: 1, surfHour: 7 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      caller.surfSessions.create({
        date: record.date,
        spotName: record.spotName,
        surfHour: 24,
        waveQuality: 4,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(fetch).not.toHaveBeenCalled();
    expect(updateSurfSession).not.toHaveBeenCalled();
  });
});
