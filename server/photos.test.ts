import type { Server } from "http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { COOKIE_NAME } from "../shared/const.js";
import { createApp } from "./_core/app.js";
import { sdk } from "./_core/sdk.js";
import type { TrpcContext } from "./_core/context.js";
import { appRouter } from "./routers.js";
import {
  changeSessionPhotos, createSurfSession, deleteSurfSession, getSessionById, getSessionPhoto, getSessionPhotos,
  canFriendViewSession, getSessionsSharedWithUser, getUserByOpenId, isPhotoPathReferenced, removeSessionPhotos, updateSurfSession,
} from "./db.js";
import { isR2PhotoPath } from "./photos.js";
import { reservePhotoUpload } from "./videoUploads.js";

vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: vi.fn() }));
vi.mock("./_core/env.js", () => ({ ENV: {
  cookieSecret: "test-cookie-secret", r2AccountId: "test-account", r2AccessKeyId: "test-key",
  r2SecretAccessKey: "test-secret", r2Bucket: "test-bucket",
} }));
vi.mock("./db.js", () => ({
  getDb: vi.fn(), getUserByOpenId: vi.fn(), getSessionPhoto: vi.fn(), getSessionPhotos: vi.fn(), getSessionById: vi.fn(),
  createSurfSession: vi.fn(), updateSurfSession: vi.fn(), deleteSurfSession: vi.fn(), changeSessionPhotos: vi.fn(async () => []),
  removeSessionPhotos: vi.fn(), isPhotoPathReferenced: vi.fn(), isVideoPathReferenced: vi.fn(),
  canFriendViewSession: vi.fn(), getSessionsSharedWithUser: vi.fn(),
}));
vi.mock("./videoUploads.js", () => ({ reservePhotoUpload: vi.fn(), reserveVideoUpload: vi.fn() }));

const photo = (n: number) => `r2/surf-photos/42/photo-123-${n.toString(16).padStart(16, "0")}.jpg`;
const users: Record<string, { id: number; openId: string }> = {
  "google:owner": { id: 42, openId: "google:owner" },
  "google:other": { id: 43, openId: "google:other" },
};
const caller = appRouter.createCaller({ user: { id: 42 }, req: {}, res: {} } as TrpcContext);
const record = { date: "2025-11-21", spotName: "烏石港", waveQuality: 4 };

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
  vi.mocked(getSessionPhoto).mockResolvedValue({ id: 3, sessionId: 7, userId: 42, photoPath: photo(1) });
  vi.mocked(getSignedUrl).mockResolvedValue("https://signed.example.com/photo");
  vi.mocked(getSessionById).mockResolvedValue({ id: 7, userId: 42 } as never);
  vi.mocked(getSessionPhotos).mockResolvedValue([]);
  vi.mocked(removeSessionPhotos).mockResolvedValue([]);
  vi.mocked(isPhotoPathReferenced).mockResolvedValue(false);
  vi.mocked(createSurfSession).mockResolvedValue([{ insertId: 7 }] as never);
  vi.mocked(canFriendViewSession).mockResolvedValue(false);
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
});

async function view(path: string, openId?: string) {
  const headers: Record<string, string> = {};
  if (openId) headers.cookie = `${COOKIE_NAME}=${await sdk.createSessionToken(openId)}`;
  return fetch(`${origin}${path}`, { headers, redirect: "manual" });
}

describe("private photo viewing", () => {
  it("redirects the owner to a short-lived signed R2 link", async () => {
    const response = await view("/api/photos/3", "google:owner");
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://signed.example.com/photo");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(vi.mocked(getSignedUrl).mock.calls[0][2]).toEqual({ expiresIn: 900 });
  });

  it("refuses logged-out viewers and hides the photo from other accounts", async () => {
    expect((await view("/api/photos/3")).status).toBe(401);
    expect((await view("/api/photos/3", "google:other")).status).toBe(404);
    vi.mocked(getSessionPhoto).mockResolvedValueOnce(undefined);
    expect((await view("/api/photos/3", "google:owner")).status).toBe(404);
    expect((await view("/api/photos/abc", "google:owner")).status).toBe(404);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it("lets a friend the record is shared with see its photos", async () => {
    vi.mocked(canFriendViewSession).mockResolvedValueOnce(true);
    expect((await view("/api/photos/3", "google:other")).status).toBe(302);
    expect(canFriendViewSession).toHaveBeenCalledWith(7, 43);
  });
});

describe("photo paths and uploads", () => {
  it("accepts only the owner's generated photo paths", () => {
    expect(isR2PhotoPath(42, photo(1))).toBe(true);
    expect(isR2PhotoPath(43, photo(1))).toBe(false);
    expect(isR2PhotoPath(42, "r2/surf-photos/42/../43/photo-123-0000000000000001.jpg")).toBe(false);
    expect(isR2PhotoPath(42, "r2/surf-videos/42/video-123-0123456789abcdef.mp4")).toBe(false);
  });

  it("reserves an owner-scoped path and signs a 20MB-limited upload", async () => {
    vi.mocked(getSignedUrl).mockResolvedValueOnce("https://signed.example.com/put");
    const result = await caller.surfSessions.presignPhotoUpload({ contentType: "image/heic", size: 10 });
    expect(result.uploadUrl).toBe("https://signed.example.com/put");
    expect(isR2PhotoPath(42, result.photoPath)).toBe(true);
    expect(result.photoPath.endsWith(".heic")).toBe(true);
    expect(reservePhotoUpload).toHaveBeenCalledWith(42, result.photoPath);
    await expect(caller.surfSessions.presignPhotoUpload({ contentType: "image/png", size: 20 * 1024 * 1024 + 1 }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.surfSessions.presignPhotoUpload({ contentType: "image/gif" as never, size: 10 }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("record photos", () => {
  it("creates a record with photos and no video", async () => {
    await caller.surfSessions.create({ ...record, photoPaths: [photo(1), photo(2)] });
    expect(createSurfSession).toHaveBeenCalledWith({ ...record, userId: 42, videoPath: "", videoUrl: "" }, [photo(1), photo(2)]);
  });

  it("rejects foreign, duplicate or more than 10 photos", async () => {
    await expect(caller.surfSessions.create({ ...record, photoPaths: [photo(1).replace("/42/", "/43/")] }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.surfSessions.create({ ...record, photoPaths: [photo(1), photo(1)] }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.surfSessions.create({ ...record, photoPaths: Array.from({ length: 11 }, (_, i) => photo(i)) }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(createSurfSession).not.toHaveBeenCalled();
  });

  it("lists the record's photos through private links", async () => {
    vi.mocked(getSessionById).mockResolvedValueOnce({ id: 7, userId: 42, videoPath: "", videoUrl: "" } as never);
    vi.mocked(getSessionPhotos).mockResolvedValueOnce([{ id: 3, sessionId: 7, userId: 42, photoPath: photo(1), createdAt: new Date() }]);
    expect((await caller.surfSessions.getById({ id: 7 }))?.photos).toEqual([{ id: 3, url: "/api/photos/3" }]);
  });

  it("shows a shared record's photos to the friend", async () => {
    vi.mocked(getSessionById).mockResolvedValueOnce(undefined);
    vi.mocked(getSessionsSharedWithUser).mockResolvedValueOnce([{ id: 7, userId: 41, videoUrl: "", ownerName: "Amy" }] as never);
    vi.mocked(getSessionPhotos).mockResolvedValueOnce([{ id: 3, sessionId: 7, userId: 41, photoPath: photo(1), createdAt: new Date() }]);
    expect(await caller.surfSessions.getById({ id: 7 })).toMatchObject({ isOwner: false, photos: [{ id: 3, url: "/api/photos/3" }] });
    expect(getSessionPhotos).toHaveBeenCalledWith(7, 41);
  });

  it("adds and removes photos on edit and deletes removed files from R2", async () => {
    const send = vi.spyOn(S3Client.prototype, "send").mockResolvedValue({} as never);
    vi.mocked(getSessionPhotos).mockResolvedValueOnce([{ id: 3, sessionId: 7, userId: 42, photoPath: photo(1), createdAt: new Date() }]);
    vi.mocked(changeSessionPhotos).mockResolvedValueOnce([{ id: 3, sessionId: 7, userId: 42, photoPath: photo(1), createdAt: new Date() }]);
    await caller.surfSessions.update({ id: 7, addPhotoPaths: [photo(2)], removePhotoIds: [3] });
    expect(changeSessionPhotos).toHaveBeenCalledWith(7, 42, [3], [photo(2)]);
    expect(updateSurfSession).not.toHaveBeenCalled();
    const command = send.mock.calls[0][0] as DeleteObjectCommand;
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    expect(command.input).toEqual({ Bucket: "test-bucket", Key: photo(1) });
    send.mockRestore();
  });

  it("keeps existing photos when saving the record fails", async () => {
    vi.mocked(updateSurfSession).mockRejectedValueOnce(new Error("database failed"));
    await expect(caller.surfSessions.update({ id: 7, note: "x", removePhotoIds: [3] })).rejects.toThrow("database failed");
    expect(changeSessionPhotos).not.toHaveBeenCalled();
  });

  it("keeps the 10-photo limit across existing and new photos", async () => {
    vi.mocked(getSessionPhotos).mockResolvedValueOnce(Array.from({ length: 10 }, (_, i) => (
      { id: i + 1, sessionId: 7, userId: 42, photoPath: photo(i), createdAt: new Date() })));
    await expect(caller.surfSessions.update({ id: 7, addPhotoPaths: [photo(20)] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(changeSessionPhotos).not.toHaveBeenCalled();
  });

  it("refuses photo changes on another account's record", async () => {
    vi.mocked(getSessionById).mockResolvedValueOnce(undefined);
    await expect(caller.surfSessions.update({ id: 7, addPhotoPaths: [photo(2)] })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(changeSessionPhotos).not.toHaveBeenCalled();
  });

  it("removes a deleted record's photos from the database and R2", async () => {
    const send = vi.spyOn(S3Client.prototype, "send").mockResolvedValue({} as never);
    vi.mocked(getSessionById).mockResolvedValueOnce({ id: 7, userId: 42, videoPath: "", videoUrl: "" } as never);
    vi.mocked(removeSessionPhotos).mockResolvedValueOnce([{ id: 3, sessionId: 7, userId: 42, photoPath: photo(1), createdAt: new Date() }]);
    await caller.surfSessions.delete({ id: 7 });
    expect(removeSessionPhotos).toHaveBeenCalledWith(7, 42);
    expect(deleteSurfSession).toHaveBeenCalledWith(7, 42);
    expect((send.mock.calls[0][0] as DeleteObjectCommand).input).toEqual({ Bucket: "test-bucket", Key: photo(1) });
    send.mockRestore();
  });
});
