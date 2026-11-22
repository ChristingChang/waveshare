import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { drizzle } from "drizzle-orm/mysql2";

vi.mock("drizzle-orm/mysql2", () => ({ drizzle: vi.fn() }));
vi.mock("mysql2/promise", () => ({ createPool: vi.fn(() => ({})) }));

const limit = vi.fn();
const where = vi.fn(() => ({ limit }));
const from = vi.fn(() => ({ where }));
const select = vi.fn(() => ({ from }));
const path = "r2/surf-videos/42/video-123-0123456789abcdef.mp4";

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("DATABASE_URL", "mysql://test:test@localhost/test");
  vi.mocked(drizzle).mockReturnValue({ select } as never);
});
afterEach(() => vi.unstubAllEnvs());

describe("remaining session video references", () => {
  it.each([{ rows: [] }, { rows: [{ id: 8 }] }])("checks the exact path across sessions: $rows", async ({ rows }) => {
    limit.mockResolvedValueOnce(rows);
    const { isVideoPathReferenced } = await import("./db.js");
    expect(await isVideoPathReferenced(path)).toBe(rows.length > 0);
    const query = new MySqlDialect().sqlToQuery(where.mock.calls[0][0]);
    expect(query.sql).toBe("`surf_sessions`.`videoPath` = ?");
    expect(query.params).toEqual([path]);
    expect(limit).toHaveBeenCalledWith(1);
  });

  it("throws rather than reporting no references when the database is unavailable", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const { isVideoPathReferenced } = await import("./db.js");
    await expect(isVideoPathReferenced(path)).rejects.toThrow("Database not available");
    expect(select).not.toHaveBeenCalled();
  });

  it("propagates query failures so the caller cannot delete the object", async () => {
    limit.mockRejectedValueOnce(new Error("query failed"));
    const { isVideoPathReferenced } = await import("./db.js");
    await expect(isVideoPathReferenced(path)).rejects.toThrow("query failed");
  });
});
