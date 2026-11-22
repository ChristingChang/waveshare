import type { Server } from "http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_NAME } from "../shared/const.js";
import { createApp } from "./_core/app.js";
import { sdk } from "./_core/sdk.js";
import { getSessionVideo, getUserByOpenId } from "./db.js";
import { canViewSessionVideo } from "./videoPlayback.js";

vi.mock("./_core/env.js", () => ({ ENV: {
  cookieSecret: "test-cookie-secret", r2AccountId: "test-account", r2AccessKeyId: "test-key",
  r2SecretAccessKey: "test-secret", r2Bucket: "test-bucket",
} }));
vi.mock("./db.js", async importOriginal => ({
  ...await importOriginal<typeof import("./db.js")>(),
  getSessionVideo: vi.fn(), getUserByOpenId: vi.fn(),
}));

const videoPath = "r2/surf-videos/42/video-123-0123456789abcdef.mp4";
const ownedSession = { id: 7, userId: 42, videoPath, videoUrl: `https://pub-old.r2.dev/${videoPath}` };
const users: Record<string, { id: number; openId: string }> = {
  "google:owner": { id: 42, openId: "google:owner" },
  "google:other": { id: 43, openId: "google:other" },
};

let server: Server;
let origin: string;

beforeAll(async () => {
  await new Promise<void>(resolve => { server = createApp().listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test port");
  origin = `http://127.0.0.1:${address.port}`;
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserByOpenId).mockImplementation(async openId => users[openId] as never);
  vi.mocked(getSessionVideo).mockResolvedValue(ownedSession);
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
});

async function play(path: string, openId?: string) {
  const headers: Record<string, string> = {};
  if (openId) headers.cookie = `${COOKIE_NAME}=${await sdk.createSessionToken(openId)}`;
  return fetch(`${origin}${path}`, { headers, redirect: "manual" });
}

describe("private video playback", () => {
  it("lets only the record's owner view by default", () => {
    expect(canViewSessionVideo({ id: 42 }, { userId: 42 })).toBe(true);
    expect(canViewSessionVideo({ id: 43 }, { userId: 42 })).toBe(false);
  });

  it("redirects the owner to a short-lived signed R2 link for an existing video", async () => {
    const response = await play("/api/videos/7", "google:owner");
    expect(response.status).toBe(302);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const location = new URL(response.headers.get("location")!);
    expect(location.origin).toBe("https://test-bucket.test-account.r2.cloudflarestorage.com");
    expect(location.pathname).toBe(`/${videoPath}`);
    expect(location.searchParams.get("X-Amz-Expires")).toBe("900");
    expect(location.searchParams.get("X-Amz-Signature")).toBeTruthy();
    expect(getSessionVideo).toHaveBeenCalledWith(7);
  });

  it.each([undefined, "google:missing"])("rejects a logged-out or unknown viewer: %s", async openId => {
    const response = await play("/api/videos/7", openId);
    expect(response.status).toBe(401);
    expect(response.headers.get("location")).toBeNull();
    expect(getSessionVideo).not.toHaveBeenCalled();
  });

  it("rejects an invalid session cookie", async () => {
    const response = await fetch(`${origin}/api/videos/7`, { headers: { cookie: `${COOKIE_NAME}=forged` }, redirect: "manual" });
    expect(response.status).toBe(401);
  });

  it("hides another account's video as not found", async () => {
    const response = await play("/api/videos/7", "google:other");
    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
  });

  it.each(["/api/videos/0", "/api/videos/abc", "/api/videos/1.5"])("returns not found for an invalid id: %s", async path => {
    const response = await play(path, "google:owner");
    expect(response.status).toBe(404);
    expect(getSessionVideo).not.toHaveBeenCalled();
  });

  it("returns not found for a missing session", async () => {
    vi.mocked(getSessionVideo).mockResolvedValueOnce(undefined);
    expect((await play("/api/videos/8", "google:owner")).status).toBe(404);
  });

  it("never signs a path outside the owner's folder", async () => {
    vi.mocked(getSessionVideo).mockResolvedValueOnce({ ...ownedSession, videoPath: videoPath.replace("/42/", "/43/"), videoUrl: "" });
    const response = await play("/api/videos/7", "google:owner");
    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
  });

  it("keeps legacy Forge videos playable for their owner", async () => {
    vi.mocked(getSessionVideo).mockResolvedValueOnce({ ...ownedSession, videoPath: "surf-videos/42/legacy.mp4", videoUrl: "https://forge.example.com/legacy.mp4" });
    const response = await play("/api/videos/7", "google:owner");
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://forge.example.com/legacy.mp4");
  });

  it("reports a database failure without leaking a link", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getSessionVideo).mockRejectedValueOnce(new Error("Database not available"));
    const response = await play("/api/videos/7", "google:owner");
    expect(response.status).toBe(500);
    expect(response.headers.get("location")).toBeNull();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
