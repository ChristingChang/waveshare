import type { Server } from "http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./_core/app.js";
import { ENV } from "./_core/env.js";
import { cleanupUnusedVideos } from "./videoCleanup.js";

vi.mock("./videoCleanup.js", () => ({ cleanupUnusedVideos: vi.fn() }));

let server: Server;
let origin: string;
const originalSecret = ENV.cronSecret;

beforeAll(async () => {
  await new Promise<void>(resolve => { server = createApp().listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test port");
  origin = `http://127.0.0.1:${address.port}`;
});
beforeEach(() => {
  vi.clearAllMocks();
  ENV.cronSecret = "test-cron-secret";
  vi.mocked(cleanupUnusedVideos).mockResolvedValue({ scanned: 1, deleted: 1, failed: 0 });
});
afterAll(async () => {
  ENV.cronSecret = originalSecret;
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
});

describe("authenticated video cleanup cron", () => {
  it.each([undefined, "Bearer wrong", "test-cron-secret"])("rejects an unauthorized request: %s", async authorization => {
    const response = await fetch(`${origin}/api/cron/cleanup-videos`, { headers: authorization ? { authorization } : {} });
    expect(response.status).toBe(401);
    expect(cleanupUnusedVideos).not.toHaveBeenCalled();
  });

  it("is disabled when CRON_SECRET is absent", async () => {
    ENV.cronSecret = "";
    const response = await fetch(`${origin}/api/cron/cleanup-videos`);
    expect(response.status).toBe(503);
    expect(cleanupUnusedVideos).not.toHaveBeenCalled();
  });

  it("runs cleanup for a Vercel bearer-authenticated GET", async () => {
    const response = await fetch(`${origin}/api/cron/cleanup-videos`, { headers: { authorization: "Bearer test-cron-secret" } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ scanned: 1, deleted: 1, failed: 0 });
    expect(cleanupUnusedVideos).toHaveBeenCalledOnce();
  });

  it("returns a generic error if cleanup cannot run", async () => {
    vi.mocked(cleanupUnusedVideos).mockRejectedValueOnce(new Error("database unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await fetch(`${origin}/api/cron/cleanup-videos`, { headers: { authorization: "Bearer test-cron-secret" } });
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: "Video cleanup failed" });
    } finally { log.mockRestore(); }
  });
});
