import { beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { getDb } from "./db.js";
import { deleteR2Video } from "./r2.js";
import { cleanupUnusedVideos } from "./videoCleanup.js";
import { surfSessions } from "../drizzle/schema.js";

vi.mock("./db.js", () => ({ getDb: vi.fn() }));
vi.mock("./r2.js", () => ({ deleteR2Video: vi.fn() }));

const limit = vi.fn();
const where = vi.fn(() => ({ limit }));
const deleteWhere = vi.fn();
const remove = vi.fn(() => ({ where: deleteWhere }));
const db = {
  select: vi.fn(() => ({ from: vi.fn(table => table === surfSessions
    ? { where: (condition: ReturnType<typeof sql>) => sql`select id from ${surfSessions} where ${condition}` }
    : { where }) })),
  delete: remove,
};
const row = { id: 1, userId: 42, videoPath: "r2/surf-videos/42/video-123-0123456789abcdef.mp4" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDb).mockResolvedValue(db as never);
  vi.mocked(deleteR2Video).mockReset().mockResolvedValue(true);
  limit.mockReset().mockResolvedValue([]);
  deleteWhere.mockReset().mockResolvedValue(undefined);
});

describe("unused video cleanup", () => {
  it("selects only expired unreferenced uploads and bounds each run", async () => {
    await expect(cleanupUnusedVideos()).resolves.toEqual({ scanned: 0, deleted: 0, failed: 0 });
    const query = new MySqlDialect().sqlToQuery(where.mock.calls[0][0]);
    expect(query.sql).toContain("`video_uploads`.`createdAt` < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 24 HOUR)");
    expect(query.sql).toContain("not exists");
    expect(query.sql).toContain("`surf_sessions`.`videoPath` = `video_uploads`.`videoPath`");
    expect(limit).toHaveBeenCalledWith(100);
    expect(deleteR2Video).not.toHaveBeenCalled();
  });

  it("removes the upload row only after its R2 object is deleted", async () => {
    limit.mockResolvedValueOnce([row]);
    await expect(cleanupUnusedVideos()).resolves.toEqual({ scanned: 1, deleted: 1, failed: 0 });
    expect(deleteR2Video).toHaveBeenCalledWith(42, row.videoPath);
    expect(deleteR2Video.mock.invocationCallOrder[0]).toBeLessThan(remove.mock.invocationCallOrder[0]);
    const query = new MySqlDialect().sqlToQuery(deleteWhere.mock.calls[0][0]);
    expect(query.params).toEqual([row.id]);
  });

  it("keeps failed uploads for retry and continues processing other rows", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    limit.mockResolvedValueOnce([row, { ...row, id: 2 }]);
    vi.mocked(deleteR2Video).mockRejectedValueOnce(new Error("R2 unavailable"));
    try {
      await expect(cleanupUnusedVideos()).resolves.toEqual({ scanned: 2, deleted: 1, failed: 1 });
      expect(remove).toHaveBeenCalledTimes(1);
      expect(log).toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });

  it("does not remove rows rejected by the owner-scoped R2 deletion guard", async () => {
    limit.mockResolvedValueOnce([{ ...row, videoPath: row.videoPath.replace("r2/", "") }]);
    vi.mocked(deleteR2Video).mockResolvedValueOnce(false);
    await expect(cleanupUnusedVideos()).resolves.toEqual({ scanned: 1, deleted: 0, failed: 0 });
    expect(remove).not.toHaveBeenCalled();
  });

  it("fails explicitly if the database is unavailable", async () => {
    vi.mocked(getDb).mockResolvedValueOnce(null);
    await expect(cleanupUnusedVideos()).rejects.toThrow("database unavailable");
  });
});
