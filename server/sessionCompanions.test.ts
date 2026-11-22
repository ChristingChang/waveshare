import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context.js";
import { appRouter } from "./routers.js";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("mysql2/promise", () => ({ createPool: () => ({ query }) }));
vi.mock("./_core/env.js", () => ({ ENV: { r2PublicUrl: "https://videos.example.com" } }));

const ownerId = 1;
const taggedId = 2;
const sessionId = 7;
const date = "2025-11-21";
const videoPath = "r2/surf-videos/1/video-123-0123456789abcdef.mp4";
const record = {
  date, spotName: "烏石港", waveQuality: 4, videoPath,
  videoUrl: `https://videos.example.com/${videoPath}`,
};

function caller(userId: number) {
  return appRouter.createCaller({ user: { id: userId }, req: {}, res: {} } as TrpcContext).surfSessions;
}

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "mysql://user:password@127.0.0.1/waveshare");
  query.mockReset();
  query.mockImplementation(async ({ sql }: { sql: string }, params: unknown[]) => {
    if (sql.startsWith("select") && sql.includes("from `friendships`")) {
      expect(sql).toContain("`friendships`.`status` = ?");
      expect(params).toEqual([ownerId, ownerId, ownerId, ownerId, "accepted"]);
      return [[[1, taggedId, ownerId, "accepted", "小安", null]]];
    }
    if (sql.startsWith("select") && sql.includes("from `session_companions`")) {
      expect(sql).toContain("inner join `surf_sessions`");
      expect(sql).toContain("`surf_sessions`.`userId` = ?");
      expect(params[0]).toBe(sessionId);
      return [params[1] === ownerId ? [[taggedId, "小安", null]] : []];
    }
    if (sql.startsWith("select") && sql.includes("from `surf_sessions`")) {
      expect(sql).toContain("`surf_sessions`.`userId` = ?");
      if (sql.endsWith("for update")) return [params[1] === ownerId ? [[sessionId]] : []];
      const ownerParam = sql.includes("`surf_sessions`.`id` = ?") ? 1 : 0;
      expect(params[ownerParam]).toBe(taggedId);
      return [[]];
    }
    return [{ insertId: sessionId, affectedRows: 1 }];
  });
});

afterEach(() => vi.unstubAllEnvs());

const statements = () => query.mock.calls.map(([options]) => options.sql as string);
const writesCompanions = () => query.mock.calls.filter(([options]) =>
  options.sql.startsWith("insert into `session_companions`"));

describe("journal companions", () => {
  it("creates and deduplicates a tag for an accepted friend", async () => {
    await caller(ownerId).create({ ...record, companionIds: [taggedId, taggedId] });
    expect(writesCompanions().map(([, params]) => params)).toEqual([[sessionId, taggedId]]);
    expect(statements()).toEqual([ "begin", expect.stringContaining("from `friendships`"),
      expect.stringContaining("insert into `surf_sessions`"),
      expect.stringContaining("insert into `session_companions`"), "commit" ]);
  });

  it("rejects an unaccepted user without changing the record or existing tags", async () => {
    await expect(caller(ownerId).update({ id: sessionId, note: "更新", companionIds: [3] }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(statements()).toEqual([ "begin", expect.stringContaining("for update"),
      expect.stringContaining("from `friendships`"), "rollback" ]);
  });

  it("replaces tags, clears them with an empty array, and leaves them alone when omitted", async () => {
    const owner = caller(ownerId);
    await owner.update({ id: sessionId, companionIds: [taggedId] });
    expect(writesCompanions().map(([, params]) => params)).toEqual([[sessionId, taggedId]]);
    expect(statements().at(-3)).toContain("delete from `session_companions`");

    query.mockClear();
    await owner.update({ id: sessionId, companionIds: [] });
    expect(statements().at(-2)).toContain("delete from `session_companions`");
    expect(writesCompanions()).toHaveLength(0);

    query.mockClear();
    await owner.update({ id: sessionId, note: "更新" });
    expect(statements()).toEqual([expect.stringContaining("update `surf_sessions`")]);
  });

  it("does not grant a tagged friend write access", async () => {
    await expect(caller(taggedId).update({ id: sessionId, companionIds: [] }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(statements()).toEqual(["begin", expect.stringContaining("for update"), "rollback"]);
  });

  it("lets the owner read tags but does not grant the tagged friend read access", async () => {
    expect(await caller(ownerId).getCompanions({ id: sessionId }))
      .toEqual([{ companionId: taggedId, name: "小安", email: null }]);
    const taggedFriend = caller(taggedId);
    expect(await taggedFriend.getCompanions({ id: sessionId })).toEqual([]);
    expect(await taggedFriend.getById({ id: sessionId })).toBeUndefined();
    expect(await taggedFriend.getAll()).toEqual([]);
    expect(await taggedFriend.getRecent()).toEqual([]);
    expect(await taggedFriend.getByDateRange({ startDate: date, endDate: date })).toEqual([]);
  });
});
