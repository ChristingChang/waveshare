import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { getDb } from "./db.js";
import { DAILY_PHOTO_UPLOAD_LIMIT, DAILY_UPLOAD_LIMIT, reservePhotoUpload, reserveVideoUpload } from "./videoUploads.js";
import { photoUploads, users, videoUploads } from "../drizzle/schema.js";

vi.mock("./r2.js", () => ({ withPlaybackUrl: vi.fn() }));
vi.mock("./db.js", async importOriginal => ({
  ...(await importOriginal<typeof import("./db.js")>()), getDb: vi.fn(),
}));

const lock = vi.fn();
const where = vi.fn(() => ({ for: lock }));
const from = vi.fn(() => ({ where }));
const select = vi.fn(() => ({ from }));
const values = vi.fn();
const insert = vi.fn(() => ({ values }));
const tx = { select, insert };
const transaction = vi.fn(async (run: (value: typeof tx) => unknown) => run(tx));

beforeEach(() => {
  vi.clearAllMocks();
  lock.mockReset();
  values.mockReset();
  vi.mocked(getDb).mockResolvedValue({ transaction } as never);
});

describe("rolling upload reservations", () => {
  it("records an upload without requiring a session, after locking the user and recent rows", async () => {
    lock.mockResolvedValueOnce([{ id: 42 }]).mockResolvedValueOnce([]);
    await reserveVideoUpload(42, "r2/surf-videos/42/video-123-0123456789abcdef.mp4");
    expect(from.mock.calls.map(call => call[0])).toEqual([users, videoUploads]);
    expect(lock.mock.calls).toEqual([["update"], ["update"]]);
    const query = new MySqlDialect().sqlToQuery(where.mock.calls[1][0]);
    expect(query.sql).toContain("DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 24 HOUR)");
    expect(query.sql).toContain("`video_uploads`.`userId` = ?");
    expect(query.params).toEqual([42]);
    expect(values).toHaveBeenCalledWith({ userId: 42, videoPath: "r2/surf-videos/42/video-123-0123456789abcdef.mp4" });
  });

  it("allows the tenth reservation and rejects the next without inserting", async () => {
    lock.mockResolvedValueOnce([{ id: 42 }]).mockResolvedValueOnce(Array.from({ length: DAILY_UPLOAD_LIMIT - 1 }, (_, id) => ({ id })));
    await reserveVideoUpload(42, "tenth");
    expect(values).toHaveBeenCalledTimes(1);
    lock.mockResolvedValueOnce([{ id: 42 }]).mockResolvedValueOnce(Array.from({ length: DAILY_UPLOAD_LIMIT }, (_, id) => ({ id })));
    await expect(reserveVideoUpload(42, "eleventh")).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS", message: expect.stringContaining("影片") });
    expect(values).toHaveBeenCalledTimes(1);
  });

  it("fails closed if the database or authenticated user is unavailable", async () => {
    vi.mocked(getDb).mockResolvedValueOnce(null);
    await expect(reserveVideoUpload(42, "unused")).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    lock.mockResolvedValueOnce([]);
    await expect(reserveVideoUpload(42, "unused")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("propagates insertion errors rather than allowing an unrecorded presign", async () => {
    lock.mockResolvedValueOnce([{ id: 42 }]).mockResolvedValueOnce([]);
    values.mockRejectedValueOnce(new Error("insert failed"));
    await expect(reserveVideoUpload(42, "unused")).rejects.toThrow("insert failed");
  });
});

describe("rolling photo upload reservations", () => {
  it.each(["select", "insert"])("explains missing photo tables during %s", async stage => {
    const error = new Error("Failed query", { cause: { code: "ER_NO_SUCH_TABLE" } });
    lock.mockResolvedValueOnce([{ id: 42 }]);
    if (stage === "select") lock.mockRejectedValueOnce(error);
    else {
      lock.mockResolvedValueOnce([]);
      values.mockRejectedValueOnce(error);
    }
    await expect(reservePhotoUpload(42, "photo")).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR", message: expect.stringContaining("drizzle/manual/0005_photos.sql"),
    });
  });

  it("preserves unrelated database errors", async () => {
    const error = new Error("connection refused");
    lock.mockRejectedValueOnce(error);
    await expect(reservePhotoUpload(42, "photo")).rejects.toBe(error);
  });

  it("records a photo upload and rejects the 101st in 24 hours", async () => {
    const path = "r2/surf-photos/42/photo-123-0123456789abcdef.jpg";
    lock.mockResolvedValueOnce([{ id: 42 }]).mockResolvedValueOnce([]);
    await reservePhotoUpload(42, path);
    expect(from.mock.calls.map(call => call[0])).toEqual([users, photoUploads]);
    expect(values).toHaveBeenCalledWith({ userId: 42, photoPath: path });

    values.mockClear();
    lock.mockResolvedValueOnce([{ id: 42 }]).mockResolvedValueOnce(Array.from({ length: DAILY_PHOTO_UPLOAD_LIMIT }, (_, id) => ({ id })));
    await expect(reservePhotoUpload(42, path)).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(values).not.toHaveBeenCalled();
  });
});
