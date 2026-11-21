import { beforeEach, describe, expect, it, vi } from "vitest";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { appRouter } from "./routers.js";
import { ENV } from "./_core/env.js";
import { createSurfSession, updateSurfSession } from "./db.js";
import type { TrpcContext } from "./_core/context.js";

vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: vi.fn() }));
vi.mock("./db.js", () => ({ createSurfSession: vi.fn(), updateSurfSession: vi.fn(), addSessionCompanions: vi.fn() }));
vi.mock("./_core/env.js", () => ({ ENV: {
  r2AccountId: "test-account", r2AccessKeyId: "test-key", r2SecretAccessKey: "test-secret",
  r2Bucket: "test-bucket", r2PublicUrl: "https://videos.example.com/",
} }));

const ctx = { user: { id: 42 }, req: {}, res: {} } as TrpcContext;
const caller = appRouter.createCaller(ctx);
const videoPath = "surf-videos/42/video-123-0123456789abcdef.mp4";
const reference = { videoPath, videoUrl: `https://videos.example.com/${videoPath}` };
const session = { date: "2025-11-21", spotName: "烏石港", waveQuality: 4, ...reference };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSignedUrl).mockResolvedValue("https://signed.example.com/put");
  vi.mocked(createSurfSession).mockResolvedValue({ insertId: 1 } as never);
  vi.mocked(updateSurfSession).mockResolvedValue({ affectedRows: 1 } as never);
});

describe("R2 presigned uploads", () => {
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
    expect(result.videoPath).toMatch(new RegExp(`^surf-videos/42/video-\\d+-[a-f0-9]{16}\\.${extension}$`));
    expect(result).toEqual({ uploadUrl: "https://signed.example.com/put", videoPath: result.videoPath,
      videoUrl: `https://videos.example.com/${result.videoPath}` });
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

  it.each(["", "not-a-url", "http://videos.example.com", "https://videos.example.com?token=1"])("rejects invalid public URL configuration: %s", async value => {
    const original = ENV.r2PublicUrl;
    ENV.r2PublicUrl = value;
    try {
      await expect(caller.surfSessions.presignUpload({ contentType: "video/mp4", size: 10 }))
        .rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: expect.stringContaining("R2_PUBLIC_URL") });
      expect(getSignedUrl).not.toHaveBeenCalled();
    } finally { ENV.r2PublicUrl = original; }
  });
});

describe("session video ownership", () => {
  it("requires authentication for create and update", async () => {
    const anonymous = appRouter.createCaller({ ...ctx, user: null });
    await expect(anonymous.surfSessions.create(session)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anonymous.surfSessions.update({ id: 7, ...reference })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(createSurfSession).not.toHaveBeenCalled();
    expect(updateSurfSession).not.toHaveBeenCalled();
  });

  it("accepts a matching owned reference on create and update", async () => {
    await caller.surfSessions.create(session);
    expect(createSurfSession).toHaveBeenCalledWith({ ...session, userId: 42 });
    await caller.surfSessions.update({ id: 7, ...reference });
    expect(updateSurfSession).toHaveBeenCalledWith(7, 42, reference);
  });

  it("allows metadata-only updates without replacing legacy videos", async () => {
    await caller.surfSessions.update({ id: 7, note: "更新心得" });
    expect(updateSurfSession).toHaveBeenCalledWith(7, 42, { note: "更新心得" });
  });

  it.each([
    { videoPath: videoPath.replace("/42/", "/43/"), videoUrl: reference.videoUrl },
    { videoPath: videoPath.replace("/42/", "/420/"), videoUrl: reference.videoUrl },
    { videoPath: "surf-videos/42/../43/video-123-0123456789abcdef.mp4", videoUrl: reference.videoUrl },
    { videoPath: "", videoUrl: "" },
    { videoPath, videoUrl: "https://evil.example.com/video.mp4" },
    { videoPath, videoUrl: `${reference.videoUrl}?other=1` },
  ])("rejects invalid references on create and update: %j", async invalid => {
    await expect(caller.surfSessions.create({ ...session, ...invalid })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.surfSessions.update({ id: 7, ...invalid })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(createSurfSession).not.toHaveBeenCalled();
    expect(updateSurfSession).not.toHaveBeenCalled();
  });

  it.each([{ videoPath }, { videoUrl: reference.videoUrl }])("rejects incomplete update references: %j", async partial => {
    await expect(caller.surfSessions.update({ id: 7, ...partial })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(updateSurfSession).not.toHaveBeenCalled();
  });
});
