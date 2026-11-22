import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { QueryBuilder } from "drizzle-orm/mysql-core/query-builders/query-builder";
import { drizzle } from "drizzle-orm/mysql2";

vi.mock("drizzle-orm/mysql2", () => ({ drizzle: vi.fn() }));
vi.mock("mysql2/promise", () => ({ createPool: vi.fn(() => ({})) }));

let results: (unknown[] | Error)[];
let predicates: unknown[];
const values = vi.fn().mockResolvedValue(undefined);
const removeWhere = vi.fn().mockResolvedValue(undefined);
const remove = vi.fn(() => ({ where: removeWhere }));
const insert = vi.fn(() => ({ values }));
const buildSelect = () => {
  const queryResult = async () => {
    const result = results.shift() ?? [];
    if (result instanceof Error) throw result;
    return result;
  };
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    where: (predicate: unknown) => { predicates.push(predicate); return chain; },
    for: () => chain,
    limit: () => chain,
    orderBy: () => chain,
    then: (resolve: (value: unknown) => void, reject: (error: unknown) => void) => queryResult().then(resolve, reject),
    catch: (reject: (error: unknown) => void) => queryResult().catch(reject),
    getSQL: () => { throw new Error("Subquery should be compiled by Drizzle in SQL-specific test"); },
  };
  return chain;
};
const select = vi.fn(buildSelect);
const database = { select, delete: remove, insert, transaction: async (fn: (tx: unknown) => unknown) => fn(database) };

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  removeWhere.mockReset().mockResolvedValue(undefined);
  results = [];
  predicates = [];
  vi.stubEnv("DATABASE_URL", "mysql://test:test@localhost/test");
  vi.mocked(drizzle).mockReturnValue(database as never);
});
afterEach(() => vi.unstubAllEnvs());

describe("session share persistence", () => {
  const missingTableErrors = [
    Object.assign(new Error("Table does not exist"), { code: "ER_NO_SUCH_TABLE" }),
    Object.assign(new Error("Table does not exist"), { errno: 1146 }),
    Object.assign(new Error("Failed query"), { cause: { code: "ER_NO_SUCH_TABLE" } }),
    Object.assign(new Error("Failed query"), { cause: { cause: { errno: 1146 } } }),
  ];

  it.each(missingTableErrors)("treats missing-table errors as no sharing: %s", async error => {
    const { getSessionShareIds, getSessionsSharedWithUser, canFriendViewSession } = await import("./db.js");
    results = [error, error, error];
    expect(await getSessionShareIds(7)).toEqual([]);
    expect(await getSessionsSharedWithUser(2)).toEqual([]);
    expect(await canFriendViewSession(7, 2)).toBe(false);
  });

  it.each(missingTableErrors)("reports sharing as not enabled when replacing shares: %s", async error => {
    results = [[{ id: 7, userId: 1 }], []];
    removeWhere.mockRejectedValueOnce(error);
    const { setSessionShares } = await import("./db.js");
    await expect(setSessionShares(7, 1, [2])).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: "分享功能尚未啟用" });
    expect(insert).not.toHaveBeenCalled();
  });

  it.each(missingTableErrors)("still deletes an owned record without the sharing table: %s", async error => {
    results = [[{ id: 7 }]];
    removeWhere.mockRejectedValueOnce(error);
    const { deleteSurfSession } = await import("./db.js");
    const { sessionShares, surfSessions } = await import("../drizzle/schema.js");
    await deleteSurfSession(7, 1);
    expect(remove.mock.calls.map(call => call[0])).toEqual([sessionShares, surfSessions]);
  });

  it("propagates unrelated errors rather than hiding them", async () => {
    const error = Object.assign(new Error("Connection lost"), { code: "PROTOCOL_CONNECTION_LOST", errno: 2013 });
    const { getSessionShareIds, getSessionsSharedWithUser, canFriendViewSession, setSessionShares, deleteSurfSession } = await import("./db.js");
    results = [error, error, error, [{ id: 7, userId: 1 }], [], [{ id: 7 }]];
    await expect(getSessionShareIds(7)).rejects.toBe(error);
    await expect(getSessionsSharedWithUser(2)).rejects.toBe(error);
    await expect(canFriendViewSession(7, 2)).rejects.toBe(error);
    removeWhere.mockRejectedValueOnce(error);
    await expect(setSessionShares(7, 1, [])).rejects.toBe(error);
    removeWhere.mockRejectedValueOnce(error);
    await expect(deleteSurfSession(7, 1)).rejects.toBe(error);
    expect(remove).toHaveBeenCalledTimes(2);
  });

  it("does not loop on a cyclic error cause", async () => {
    const error = Object.assign(new Error("Other error"), { cause: {} });
    error.cause = { cause: error };
    results = [error];
    const { getSessionShareIds } = await import("./db.js");
    await expect(getSessionShareIds(7)).rejects.toBe(error);
  });

  it("replaces the set, deduplicates, and drops self, pending, rejected and non-friends", async () => {
    results = [[{ id: 7, userId: 1 }], [
      { userId: 1, friendId: 2, status: "accepted" },
      { userId: 3, friendId: 1, status: "accepted" },
    ]];
    const { setSessionShares } = await import("./db.js");
    expect(await setSessionShares(7, 1, [1, 2, 2, 3, 4, 5])).toEqual([2, 3]);
    expect(values).toHaveBeenCalledWith([{ sessionId: 7, friendId: 2 }, { sessionId: 7, friendId: 3 }]);
    expect(remove).toHaveBeenCalledTimes(1);
    const query = new MySqlDialect().sqlToQuery(predicates[1] as never);
    expect(query.sql).toContain("`friendships`.`status` = ?");
    expect(query.params).toEqual(["accepted", 1, 1]);
  });

  it("clears all shares for an empty replacement", async () => {
    results = [[{ id: 7, userId: 1 }], []];
    const { setSessionShares } = await import("./db.js");
    expect(await setSessionShares(7, 1, [])).toEqual([]);
    expect(remove).toHaveBeenCalledOnce();
    expect(insert).not.toHaveBeenCalled();
  });

  it("does not change shares for a non-owner", async () => {
    results = [[]];
    const { setSessionShares } = await import("./db.js");
    await expect(setSessionShares(7, 9, [2])).rejects.toThrow("Session not found");
    expect(remove).not.toHaveBeenCalled();
    const query = new MySqlDialect().sqlToQuery(predicates[0] as never);
    expect(query.params).toEqual([7, 9]);
  });

  it("reads share ids and handles no shares", async () => {
    results = [[{ friendId: 2 }], []];
    const { getSessionShareIds } = await import("./db.js");
    expect(await getSessionShareIds(7)).toEqual([2]);
    expect(await getSessionShareIds(8)).toEqual([]);
  });

  it("checks a share plus a currently accepted friendship in either direction", async () => {
    const builder = new QueryBuilder();
    select.mockImplementationOnce(buildSelect).mockImplementationOnce((...args: any[]) => (builder.select as any)(...args));
    results = [[{ id: 1 }], []];
    const { canFriendViewSession } = await import("./db.js");
    expect(await canFriendViewSession(7, 2)).toBe(true);
    const query = new MySqlDialect().sqlToQuery(predicates[0] as never);
    expect(query.sql).toContain("exists (select");
    expect(query.sql).toContain("`friendships`.`status` = ?");
    expect(query.sql).toContain("`friendships`.`userId` = `surf_sessions`.`userId`");
    expect(query.sql).toContain("`friendships`.`friendId` = `surf_sessions`.`userId`");
    expect(query.params).toEqual([7, 2, "accepted", 2, 2]);
    expect(await canFriendViewSession(7, 2)).toBe(false);
  });

  it("returns shared records with owner names and private playback URLs", async () => {
    results = [[{ session: { id: 7, videoUrl: "https://private.example/video", videoPath: "secret" }, ownerName: "小浪" }], []];
    const { getSessionsSharedWithUser } = await import("./db.js");
    expect(await getSessionsSharedWithUser(2)).toEqual([{ id: 7, videoUrl: "/api/videos/7", videoPath: "secret", ownerName: "小浪" }]);
    expect(await getSessionsSharedWithUser(2)).toEqual([]);
  });

  it("deletes shares only for the owner when deleting a record", async () => {
    results = [[{ id: 7 }], []];
    const { deleteSurfSession } = await import("./db.js");
    await deleteSurfSession(7, 1);
    expect(remove).toHaveBeenCalledTimes(2);
    await deleteSurfSession(7, 2);
    expect(remove).toHaveBeenCalledTimes(2);
  });

  it("fails closed when the database is unavailable", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const { setSessionShares, canFriendViewSession, getSessionsSharedWithUser, getSessionShareIds } = await import("./db.js");
    await expect(setSessionShares(7, 1, [2])).rejects.toThrow("Database not available");
    await expect(canFriendViewSession(7, 2)).rejects.toThrow("Database not available");
    await expect(getSessionsSharedWithUser(2)).rejects.toThrow("Database not available");
    await expect(getSessionShareIds(7)).rejects.toThrow("Database not available");
  });
});
