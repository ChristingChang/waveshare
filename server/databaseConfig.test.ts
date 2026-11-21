import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import { databaseConfig } from "./_core/databaseConfig.js";

vi.mock("drizzle-orm/mysql2", () => ({ drizzle: vi.fn() }));
vi.mock("mysql2/promise", () => ({ createPool: vi.fn() }));

afterEach(() => vi.unstubAllEnvs());

describe("MySQL and TiDB TLS configuration", () => {
  it.each([
    { host: "gateway.example.tidbcloud.com", flag: undefined, tls: true },
    { host: "gateway.example.tidbcloud.com", flag: "false", tls: true },
    { host: "mysql.example.com", flag: "true", tls: true },
    { host: "localhost", flag: undefined, tls: false },
    { host: "127.0.0.1", flag: "false", tls: false },
    { host: "not-tidbcloud.com", flag: undefined, tls: false },
    { host: "gateway.tidbcloud.com.evil.example", flag: undefined, tls: false },
  ])("applies the shared TLS rule for $host ($flag)", ({ host, flag, tls }) => {
    const config = databaseConfig(`mysql://user:password@${host}/waveshare`, flag);
    expect(config.ssl).toEqual(tls ? { minVersion: "TLSv1.2", rejectUnauthorized: true } : undefined);
  });

  it("decodes URL credentials without losing special characters", () => {
    expect(databaseConfig("mysql://user%40tenant:pass%3Aword%40host@localhost:4000/wave%20share")).toMatchObject({
      user: "user@tenant", password: "pass:word@host", host: "localhost", port: 4000, database: "wave share",
    });
  });

  it.each(["", "not a URL", "https://example.com/database"])("rejects an invalid connection URL: %s", url => {
    expect(() => databaseConfig(url)).toThrow();
  });
});

describe("serverless database pool", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("lazily creates and reuses a small TLS pool", async () => {
    vi.stubEnv("DATABASE_URL", "mysql://user:password@gateway.tidbcloud.com/waveshare");
    const pool = {};
    const db = {};
    vi.mocked(createPool).mockReturnValue(pool as never);
    vi.mocked(drizzle).mockReturnValue(db as never);
    const { getDb } = await import("./db.js");
    expect(createPool).not.toHaveBeenCalled();
    expect(await getDb()).toBe(db);
    expect(await getDb()).toBe(db);
    expect(createPool).toHaveBeenCalledOnce();
    expect(createPool).toHaveBeenCalledWith(expect.objectContaining({ connectionLimit: 3, ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true } }));
    expect(drizzle).toHaveBeenCalledWith(pool);
  });

  it("does not open a pool if DATABASE_URL is absent", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const { getDb } = await import("./db.js");
    expect(await getDb()).toBeNull();
    expect(createPool).not.toHaveBeenCalled();
  });
});
