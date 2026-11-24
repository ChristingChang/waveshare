import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { drizzle } from "drizzle-orm/mysql2";

vi.mock("drizzle-orm/mysql2", () => ({ drizzle: vi.fn() }));
vi.mock("mysql2/promise", () => ({ createPool: vi.fn() }));

const code = "a".repeat(64);
let results: unknown[][];
let conditions: unknown[];
const onDuplicateKeyUpdate = vi.fn();
const values = vi.fn(() => ({ onDuplicateKeyUpdate }));
const where = vi.fn();
const set = vi.fn(() => ({ where }));
const select = () => {
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    where: (condition: unknown) => { conditions.push(condition); return chain; },
    orderBy: () => chain,
    for: () => chain,
    then: (resolve: (value: unknown) => void) => Promise.resolve(results.shift()).then(resolve),
  };
  return chain;
};
const db = {
  select,
  insert: () => ({ values }),
  update: () => ({ set }),
  transaction: async (run: (tx: unknown) => unknown) => run(db),
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("DATABASE_URL", "mysql://test:test@localhost/test");
  vi.mocked(drizzle).mockReturnValue(db as never);
  results = [];
  conditions = [];
});
afterEach(() => vi.unstubAllEnvs());

describe("friend invite links", () => {
  it("reuses the stored link without writing a new code", async () => {
    results = [[{ code }]];
    const { getFriendInviteCode } = await import("./db.js");
    expect(await getFriendInviteCode(2)).toBe(code);
    expect(values).not.toHaveBeenCalled();
  });

  it("creates an opaque code but returns the saved winner if creation raced", async () => {
    results = [[], [{ code }]];
    const { getFriendInviteCode } = await import("./db.js");
    expect(await getFriendInviteCode(2)).toBe(code);
    expect(values).toHaveBeenCalledWith({ inviterId: 2, code: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(onDuplicateKeyUpdate).toHaveBeenCalledOnce();
  });

  it("creates one accepted row and looks up both directions under ordered user locks", async () => {
    results = [[{ inviterId: 4 }], [], [], []];
    const { acceptFriendInvite } = await import("./db.js");
    expect(await acceptFriendInvite(2, code)).toEqual({ success: true });
    expect(values.mock.calls).toEqual([[{ userId: 4, friendId: 2, status: "accepted" }]]);
    const params = conditions.map(condition => new MySqlDialect().sqlToQuery(condition as never).params);
    expect(params).toEqual([[code], [2], [4], [4, 2, 2, 4]]);
  });

  it.each([
    { userId: 4, friendId: 2, status: "pending" },
    { userId: 2, friendId: 4, status: "pending" },
    { userId: 2, friendId: 4, status: "rejected" },
  ])("reuses an existing $status row ($userId → $friendId)", async row => {
    results = [[{ inviterId: 4 }], [], [], [{ id: 7, ...row }]];
    const { acceptFriendInvite } = await import("./db.js");
    expect(await acceptFriendInvite(2, code)).toEqual({ success: true });
    expect(set.mock.calls).toEqual([[{ status: "accepted" }]]);
    expect(new MySqlDialect().sqlToQuery(where.mock.calls[0][0] as never).params).toEqual([7]);
    expect(values).not.toHaveBeenCalled();
  });

  it("is a no-op for existing friends", async () => {
    results = [[{ inviterId: 4 }], [], [], [{ id: 7, status: "accepted" }]];
    const { acceptFriendInvite } = await import("./db.js");
    expect(await acceptFriendInvite(2, code)).toEqual({ success: true });
    expect(set).not.toHaveBeenCalled();
    expect(values).not.toHaveBeenCalled();
  });

  it.each([
    { invites: [], error: "NOT_FOUND" },
    { invites: [{ inviterId: 2 }], error: "BAD_REQUEST" },
  ])("does not write a friendship for $error", async ({ invites, error }) => {
    results = [invites];
    const { acceptFriendInvite } = await import("./db.js");
    await expect(acceptFriendInvite(2, code)).rejects.toMatchObject({ code: error });
    expect(set).not.toHaveBeenCalled();
    expect(values).not.toHaveBeenCalled();
  });
});
