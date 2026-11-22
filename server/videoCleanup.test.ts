import { beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { getDb } from "./db.js";
import { deleteR2Video } from "./r2.js";
import { deleteR2Photo } from "./photos.js";
import { cleanupUnusedPhotos, cleanupUnusedVideos } from "./videoCleanup.js";
import { sessionPhotos, surfSessions } from "../drizzle/schema.js";

vi.mock("./db.js", () => ({ getDb: vi.fn() }));
vi.mock("./r2.js", () => ({ deleteR2Video: vi.fn() }));
vi.mock("./photos.js", () => ({ deleteR2Photo: vi.fn() }));

const limit = vi.fn();
const where = vi.fn(() => ({ limit }));
const deleteWhere = vi.fn();
const remove = vi.fn(() => ({ where: deleteWhere }));
const db = {
  select: vi.fn(() => ({ from: vi.fn(table => table === surfSessions || table === sessionPhotos
    ? { where: (condition: ReturnType<typeof sql>) => sql`select id from ${table} where ${condition}` }
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

describe("unused photo cleanup", () => {
  const photoRow = { id: 5, userId: 42, photoPath: "r2/surf-photos/42/photo-123-0123456789abcdef.jpg" };

  it("deletes expired photo uploads no record uses, R2 first", async () => {
    vi.mocked(deleteR2Photo).mockResolvedValue(true);
    limit.mockResolvedValueOnce([photoRow]);
    await expect(cleanupUnusedPhotos()).resolves.toEqual({ scanned: 1, deleted: 1, failed: 0 });
    const query = new MySqlDialect().sqlToQuery(where.mock.calls[0][0]);
    expect(query.sql).toContain("`photo_uploads`.`createdAt` < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 24 HOUR)");
    expect(query.sql).toContain("`session_photos`.`photoPath` = `photo_uploads`.`photoPath`");
    expect(deleteR2Photo).toHaveBeenCalledWith(42, photoRow.photoPath);
    expect(vi.mocked(deleteR2Photo).mock.invocationCallOrder[0]).toBeLessThan(remove.mock.invocationCallOrder[0]);
  });

  it("keeps the upload row when the R2 delete fails", async () => {
    vi.mocked(deleteR2Photo).mockRejectedValueOnce(new Error("R2 down"));
    limit.mockResolvedValueOnce([photoRow]);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(cleanupUnusedPhotos()).resolves.toEqual({ scanned: 1, deleted: 0, failed: 1 });
      expect(remove).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });
});
