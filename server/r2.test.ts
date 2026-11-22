import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { appRouter } from "./routers.js";
import { ENV } from "./_core/env.js";
import { createSurfSession, deleteSurfSession, updateSurfSession, getUserRecentSessions, getUserAllSessions, getUserSessionsByDateRange, getSessionById, isVideoPathReferenced } from "./db.js";
import { deleteR2Video } from "./r2.js";
import type { TrpcContext } from "./_core/context.js";
import { reserveVideoUpload } from "./videoUploads.js";

vi.mock("./videoUploads.js", () => ({ reserveVideoUpload: vi.fn() }));

vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: vi.fn() }));
vi.mock("./db.js", () => ({
  createSurfSession: vi.fn(), deleteSurfSession: vi.fn(), updateSurfSession: vi.fn(), addSessionCompanions: vi.fn(), isVideoPathReferenced: vi.fn(),
  getUserRecentSessions: vi.fn(), getUserAllSessions: vi.fn(), getUserSessionsByDateRange: vi.fn(), getSessionById: vi.fn(),
  getSessionsSharedWithUser: vi.fn().mockResolvedValue([]),
}));
vi.mock("./_core/env.js", () => ({ ENV: {
  r2AccountId: "test-account", r2AccessKeyId: "test-key", r2SecretAccessKey: "test-secret",
  r2Bucket: "test-bucket",
} }));

const ctx = { user: { id: 42 }, req: {}, res: {} } as TrpcContext;
const caller = appRouter.createCaller(ctx);
const videoPath = "r2/surf-videos/42/video-123-0123456789abcdef.mp4";
const session = { date: "2025-11-21", spotName: "烏石港", waveQuality: 4, videoPath };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isVideoPathReferenced).mockResolvedValue(false);
  vi.mocked(reserveVideoUpload).mockResolvedValue(undefined);
  vi.mocked(getSignedUrl).mockResolvedValue("https://signed.example.com/put");
  vi.mocked(createSurfSession).mockResolvedValue({ insertId: 1 } as never);
  vi.mocked(updateSurfSession).mockResolvedValue({ affectedRows: 1 } as never);
});

describe("session reads return a private playback URL", () => {
  const storedSession = {
    ...session, id: 7, userId: 42, spotLat: null, spotLng: null, note: null, boardType: null,
    createdAt: new Date(), updatedAt: new Date(), videoUrl: `https://pub-old.r2.dev/${videoPath}`,
  };
  const readers = [
    { name: "getRecent", read: () => caller.surfSessions.getRecent().then(rows => rows[0]) },
    { name: "getAll", read: () => caller.surfSessions.getAll().then(rows => rows[0]) },
    { name: "getByDateRange", read: () => caller.surfSessions.getByDateRange({ startDate: "2025-01-01", endDate: "2025-12-31" }).then(rows => rows[0]) },
    { name: "getById", read: () => caller.surfSessions.getById({ id: 7 }) },
  ];

  function mockReads(row = storedSession) {
    vi.mocked(getUserRecentSessions).mockResolvedValue([row]);
    vi.mocked(getUserAllSessions).mockResolvedValue([row]);
    vi.mocked(getUserSessionsByDateRange).mockResolvedValue([row]);
    vi.mocked(getSessionById).mockResolvedValue(row);
  }

  it.each(readers)("$name never exposes the stored public R2 URL", async ({ name, read }) => {
    mockReads();
    expect(await read()).toEqual({ ...storedSession, videoUrl: "/api/videos/7", ...(name === "getById" ? { isOwner: true, ownerName: undefined } : {}) });
    expect(storedSession.videoUrl).toBe(`https://pub-old.r2.dev/${videoPath}`);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it.each(readers)("$name routes legacy Forge videos through the same playback check", async ({ name, read }) => {
    const legacy = { ...storedSession, videoPath: "surf-videos/42/video-123-0123456789abcdef.mp4", videoUrl: "https://forge.example.com/legacy.mp4" };
    mockReads(legacy);
    expect(await read()).toEqual({ ...legacy, videoUrl: "/api/videos/7", ...(name === "getById" ? { isOwner: true, ownerName: undefined } : {}) });
  });

  it("preserves empty and missing read results", async () => {
    vi.mocked(getUserRecentSessions).mockResolvedValue([]);
    vi.mocked(getUserAllSessions).mockResolvedValue([]);
    vi.mocked(getUserSessionsByDateRange).mockResolvedValue([]);
    vi.mocked(getSessionById).mockResolvedValue(undefined);
    expect(await caller.surfSessions.getRecent()).toEqual([]);
    expect(await caller.surfSessions.getAll()).toEqual([]);
    expect(await caller.surfSessions.getByDateRange({ startDate: "2025-01-01", endDate: "2025-12-31" })).toEqual([]);
    expect(await caller.surfSessions.getById({ id: 7 })).toBeUndefined();
  });

  it("allows metadata updates on old sessions without touching the stored URL", async () => {
    mockReads();
    await caller.surfSessions.update({ id: 7, note: "更新心得" });
    expect(updateSurfSession).toHaveBeenCalledWith(7, 42, { note: "更新心得" });
  });
});

describe("R2 presigned uploads", () => {
  it("does not sign when the rolling upload quota is exhausted", async () => {
    const { TRPCError } = await import("@trpc/server");
    vi.mocked(reserveVideoUpload).mockRejectedValueOnce(new TRPCError({ code: "TOO_MANY_REQUESTS", message: "影片上傳已達上限，請稍後再試" }));
    await expect(caller.surfSessions.presignUpload({ contentType: "video/mp4", size: 10 }))
      .rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it("does not sign when the upload reservation cannot be persisted", async () => {
    vi.mocked(reserveVideoUpload).mockRejectedValueOnce(new Error("database unavailable"));
    await expect(caller.surfSessions.presignUpload({ contentType: "video/mp4", size: 10 })).rejects.toThrow("database unavailable");
    expect(getSignedUrl).not.toHaveBeenCalled();
  });
  it("requires authentication", async () => {
    const anonymous = appRouter.createCaller({ ...ctx, user: null });
    await expect(anonymous.surfSessions.presignUpload({ contentType: "video/mp4", size: 10 }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it.each([
    { contentType: "text/plain", size: 10 },
    { contentType: "video/avi", size: 10 },
    { contentType: "video/mp4", size: 0 },
    { contentType: "video/mp4", size: -1 },
    { contentType: "video/mp4", size: 1.5 },
    { contentType: "video/mp4", size: 100 * 1024 * 1024 + 1 },
  ])("rejects invalid declared metadata: %j", async input => {
    await expect(caller.surfSessions.presignUpload(input as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it.each([
    ["video/mp4", "mp4"], ["video/quicktime", "mov"], ["video/webm", "webm"],
  ] as const)("signs a scoped %s upload with the content type and size", async (contentType, extension) => {
    const result = await caller.surfSessions.presignUpload({ contentType, size: 100 * 1024 * 1024 });
    expect(result.videoPath).toMatch(new RegExp(`^r2/surf-videos/42/video-\\d+-[a-f0-9]{16}\\.${extension}$`));
    expect(reserveVideoUpload).toHaveBeenCalledWith(42, result.videoPath);
    expect(result).toEqual({ uploadUrl: "https://signed.example.com/put", videoPath: result.videoPath });
    const [client, command, options] = vi.mocked(getSignedUrl).mock.calls[0];
    expect(client).toBeInstanceOf(S3Client);
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect((command as PutObjectCommand).input).toEqual({
      Bucket: "test-bucket", Key: result.videoPath, ContentType: contentType, ContentLength: 100 * 1024 * 1024,
    });
    expect(options).toEqual({ expiresIn: 600, signableHeaders: new Set(["content-type"]) });
  });

  it("reports missing configuration without crashing at import", async () => {
    const original = ENV.r2Bucket;
    ENV.r2Bucket = "";
    try {
      await expect(caller.surfSessions.presignUpload({ contentType: "video/mp4", size: 10 }))
        .rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: expect.stringContaining("R2_BUCKET") });
      expect(getSignedUrl).not.toHaveBeenCalled();
    } finally { ENV.r2Bucket = original; }
  });

  it("reports signing failures without writing a session", async () => {
    vi.mocked(getSignedUrl).mockRejectedValue(new Error("Signing failed"));
    await expect(caller.surfSessions.presignUpload({ contentType: "video/mp4", size: 10 })).rejects.toThrow("Signing failed");
    expect(createSurfSession).not.toHaveBeenCalled();
  });
});

describe("R2 video deletion", () => {
  afterEach(() => vi.restoreAllMocks());

  it("deletes the database session and its owner-scoped R2 object", async () => {
    const send = vi.spyOn(S3Client.prototype, "send").mockImplementation(async () => ({}));
    const destroy = vi.spyOn(S3Client.prototype, "destroy");
    vi.mocked(getSessionById).mockResolvedValueOnce({ ...session, userId: 42 } as never);
    await expect(caller.surfSessions.delete({ id: 7 })).resolves.toEqual({ success: true });
    expect(getSessionById).toHaveBeenCalledWith(7, 42);
    expect(deleteSurfSession).toHaveBeenCalledWith(7, 42);
    expect(isVideoPathReferenced).toHaveBeenCalledWith(videoPath);
    expect(deleteSurfSession.mock.invocationCallOrder[0]).toBeLessThan(isVideoPathReferenced.mock.invocationCallOrder[0]);
    expect(send.mock.calls[0][0]).toBeInstanceOf(DeleteObjectCommand);
    expect((send.mock.calls[0][0] as DeleteObjectCommand).input).toEqual({ Bucket: "test-bucket", Key: videoPath });
    expect(destroy).toHaveBeenCalled();
  });

  it("keeps a shared R2 video when another session still references it", async () => {
    const send = vi.spyOn(S3Client.prototype, "send");
    vi.mocked(getSessionById).mockResolvedValueOnce(session as never);
    vi.mocked(isVideoPathReferenced).mockResolvedValueOnce(true);
    await expect(caller.surfSessions.delete({ id: 7 })).resolves.toEqual({ success: true });
    expect(deleteSurfSession).toHaveBeenCalledWith(7, 42);
    expect(isVideoPathReferenced).toHaveBeenCalledWith(videoPath);
    expect(send).not.toHaveBeenCalled();
  });

  it("keeps the video and logs the error if checking remaining references fails", async () => {
    const send = vi.spyOn(S3Client.prototype, "send");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getSessionById).mockResolvedValueOnce(session as never);
    vi.mocked(isVideoPathReferenced).mockRejectedValueOnce(new Error("reference query failed"));
    await expect(caller.surfSessions.delete({ id: 7 })).resolves.toEqual({ success: true });
    expect(deleteSurfSession).toHaveBeenCalledWith(7, 42);
    expect(send).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith("[R2] Failed to delete session video:", expect.any(Error));
  });

  it.each([
    "surf-videos/42/video-123-0123456789abcdef.mp4",
    videoPath.replace("/42/", "/43/"),
    "r2/surf-videos/42/../43/video-123-0123456789abcdef.mp4",
    "",
  ])("never sends a storage delete for an unsafe or Forge path: %s", async path => {
    const send = vi.spyOn(S3Client.prototype, "send");
    vi.mocked(getSessionById).mockResolvedValueOnce({ ...session, videoPath: path } as never);
    await expect(caller.surfSessions.delete({ id: 7 })).resolves.toEqual({ success: true });
    expect(send).not.toHaveBeenCalled();
    expect(deleteSurfSession).toHaveBeenCalledWith(7, 42);
  });

  it("logs an R2 error without blocking session deletion and releases the client", async () => {
    vi.spyOn(S3Client.prototype, "send").mockRejectedValueOnce(new Error("storage failed") as never);
    const destroy = vi.spyOn(S3Client.prototype, "destroy");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getSessionById).mockResolvedValueOnce(session as never);
    await expect(caller.surfSessions.delete({ id: 7 })).resolves.toEqual({ success: true });
    expect(deleteSurfSession).toHaveBeenCalledWith(7, 42);
    expect(log).toHaveBeenCalledWith("[R2] Failed to delete session video:", expect.any(Error));
    expect(destroy).toHaveBeenCalled();
  });

  it("rejects an unknown session or database failure without deleting an object", async () => {
    const send = vi.spyOn(S3Client.prototype, "send");
    vi.mocked(getSessionById).mockResolvedValueOnce(undefined);
    await expect(caller.surfSessions.delete({ id: 7 })).rejects.toThrow("Session not found");
    vi.mocked(getSessionById).mockResolvedValueOnce(session as never);
    vi.mocked(deleteSurfSession).mockRejectedValueOnce(new Error("database failed"));
    await expect(caller.surfSessions.delete({ id: 7 })).rejects.toThrow("database failed");
    expect(send).not.toHaveBeenCalled();
  });

  it("requires credentials for R2 deletion but not a playback URL", async () => {
    const original = ENV.r2Bucket;
    ENV.r2Bucket = "";
    try {
      await expect(deleteR2Video(42, videoPath)).rejects.toThrow("not configured");
      await expect(deleteR2Video(42, videoPath.replace("r2/", ""))).resolves.toBe(false);
    } finally { ENV.r2Bucket = original; }
  });
});

describe("session video ownership", () => {
  it("requires authentication for create and update", async () => {
    const anonymous = appRouter.createCaller({ ...ctx, user: null });
    await expect(anonymous.surfSessions.create(session)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anonymous.surfSessions.update({ id: 7, videoPath })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(createSurfSession).not.toHaveBeenCalled();
    expect(updateSurfSession).not.toHaveBeenCalled();
  });

  it("accepts an owned path on create and update and never stores a public URL", async () => {
    await caller.surfSessions.create({ ...session, videoUrl: "https://evil.example.com/video.mp4" } as never);
    expect(createSurfSession).toHaveBeenCalledWith({ ...session, userId: 42, videoUrl: "" });
    await caller.surfSessions.update({ id: 7, videoPath, videoUrl: "https://evil.example.com/video.mp4" } as never);
    expect(updateSurfSession).toHaveBeenCalledWith(7, 42, { videoPath, videoUrl: "" });
  });

  it("allows metadata-only updates without replacing legacy videos", async () => {
    await caller.surfSessions.update({ id: 7, note: "更新心得" });
    expect(updateSurfSession).toHaveBeenCalledWith(7, 42, { note: "更新心得" });
  });

  it.each([
    videoPath.replace("/42/", "/43/"),
    videoPath.replace("/42/", "/420/"),
    "r2/surf-videos/42/../43/video-123-0123456789abcdef.mp4",
    "surf-videos/42/video-123-0123456789abcdef.mp4",
    "",
  ])("rejects invalid paths on create and update: %s", async invalid => {
    await expect(caller.surfSessions.create({ ...session, videoPath: invalid })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.surfSessions.update({ id: 7, videoPath: invalid })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(createSurfSession).not.toHaveBeenCalled();
    expect(updateSurfSession).not.toHaveBeenCalled();
  });
});
