import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { drizzle } from "drizzle-orm/mysql2";

vi.mock("drizzle-orm/mysql2", () => ({ drizzle: vi.fn() }));
vi.mock("mysql2/promise", () => ({ createPool: vi.fn(() => ({})) }));

const limit = vi.fn();
const where = vi.fn(() => ({ limit }));
const from = vi.fn(() => ({ where }));
const select = vi.fn(() => ({ from }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("DATABASE_URL", "mysql://test:test@localhost/test");
  vi.mocked(drizzle).mockReturnValue({ select } as never);
});
afterEach(() => vi.unstubAllEnvs());

describe("user search privacy", () => {
  it.each(["Alice", "private@example.com"])("searches names only for %s and selects only public fields", async query => {
    const rows = [{ id: 7, name: "Alice" }];
    limit.mockResolvedValueOnce(rows);
    const { searchUsers } = await import("./db.js");
    const { users } = await import("../drizzle/schema.js");
    expect(await searchUsers(query, 42)).toEqual(rows);
    expect(select).toHaveBeenCalledWith({ id: users.id, name: users.name });
    const sql = new MySqlDialect().sqlToQuery(where.mock.calls[0][0]);
    expect(sql.sql).toBe("(`users`.`name` like ? and `users`.`id` <> ?)");
    expect(sql.params).toEqual([`%${query}%`, 42]);
    expect(limit).toHaveBeenCalledWith(10);
  });

  it("returns no results when the database is unavailable", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const { searchUsers } = await import("./db.js");
    expect(await searchUsers("Alice", 42)).toEqual([]);
    expect(select).not.toHaveBeenCalled();
  });

  it("returns an empty search result", async () => {
    limit.mockResolvedValueOnce([]);
    const { searchUsers } = await import("./db.js");
    expect(await searchUsers("Nobody", 42)).toEqual([]);
  });

  it("propagates database errors without returning user data", async () => {
    limit.mockRejectedValueOnce(new Error("query failed"));
    const { searchUsers } = await import("./db.js");
    await expect(searchUsers("Alice", 42)).rejects.toThrow("query failed");
  });
});
