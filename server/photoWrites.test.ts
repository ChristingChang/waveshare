import { beforeEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/mysql2";

vi.mock("drizzle-orm/mysql2", () => ({ drizzle: vi.fn() }));
vi.mock("mysql2/promise", () => ({ createPool: vi.fn(() => ({})) }));

const values = vi.fn();
const insert = vi.fn(() => ({ values }));
const where = vi.fn();
const tx = { insert, select: vi.fn(() => ({ from: vi.fn(() => ({ where })) })) };
const transaction = vi.fn(async (run: (value: typeof tx) => unknown) => run(tx));
const record = { userId: 42, date: "2025-11-21", spotName: "烏石港", waveQuality: 4, videoUrl: "", videoPath: "" };

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  values.mockReset().mockResolvedValue([{ insertId: 7 }]);
  where.mockReset().mockResolvedValue([]);
  vi.stubEnv("DATABASE_URL", "mysql://test:test@localhost/test");
  vi.mocked(drizzle).mockReturnValue({ transaction } as never);
});

describe("photo writes", () => {
  it("creates records with photos and without photos", async () => {
    const { createSurfSession } = await import("./db.js");
    const { sessionPhotos } = await import("../drizzle/schema.js");
    await createSurfSession(record, ["photo"]);
    expect(insert).toHaveBeenLastCalledWith(sessionPhotos);
    expect(values).toHaveBeenLastCalledWith([{ sessionId: 7, userId: 42, photoPath: "photo" }]);
    insert.mockClear();
    await createSurfSession(record);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("explains a missing session_photos table when creating a record", async () => {
    const { createSurfSession } = await import("./db.js");
    values.mockResolvedValueOnce([{ insertId: 7 }]).mockRejectedValueOnce(new Error("Failed query", { cause: { errno: 1146 } }));
    await expect(createSurfSession(record, ["photo"])).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR", message: expect.stringContaining("drizzle/manual/0005_photos.sql"),
    });
  });

  it.each(["add", "remove"])("explains a missing table on photo %s", async operation => {
    const { changeSessionPhotos } = await import("./db.js");
    const error = new Error("Failed query", { cause: { code: "ER_NO_SUCH_TABLE" } });
    if (operation === "add") values.mockRejectedValueOnce(error);
    else where.mockRejectedValueOnce(error);
    await expect(changeSessionPhotos(7, 42, operation === "remove" ? [3] : [], operation === "add" ? ["photo"] : []))
      .rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: expect.stringContaining("drizzle/manual/0005_photos.sql") });
  });

  it("allows empty changes and successful additions", async () => {
    const { changeSessionPhotos } = await import("./db.js");
    const { sessionPhotos } = await import("../drizzle/schema.js");
    await expect(changeSessionPhotos(7, 42, [], [])).resolves.toEqual([]);
    expect(insert).not.toHaveBeenCalled();
    await expect(changeSessionPhotos(7, 42, [], ["photo"])).resolves.toEqual([]);
    expect(insert).toHaveBeenCalledWith(sessionPhotos);
  });

  it("does not relabel unrelated failures", async () => {
    const { createSurfSession, changeSessionPhotos } = await import("./db.js");
    const error = new Error("connection lost");
    values.mockResolvedValueOnce([{ insertId: 7 }]).mockRejectedValueOnce(error);
    await expect(createSurfSession(record, ["photo"])).rejects.toBe(error);
    values.mockRejectedValueOnce(error);
    await expect(changeSessionPhotos(7, 42, [], ["photo"])).rejects.toBe(error);
  });
});
