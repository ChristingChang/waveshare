import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { TRPCError } from "@trpc/server";
import { randomBytes } from "crypto";
import { Router } from "express";
import type { User } from "../drizzle/schema.js";
import { ENV } from "./_core/env.js";
import { sdk } from "./_core/sdk.js";
import { getSessionPhoto, isPhotoPathReferenced } from "./db.js";
import { PLAYBACK_URL_TTL_SECONDS, createR2Client, hasR2Config } from "./r2.js";
import { canViewSessionVideo } from "./videoPlayback.js";
import { reservePhotoUpload } from "./videoUploads.js";

export const PHOTO_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "image/heif": "heif",
} as const;
export const MAX_PHOTO_SIZE = 20 * 1024 * 1024;
export const MAX_PHOTOS_PER_SESSION = 10;

export function isR2PhotoPath(userId: number, photoPath: string) {
  const prefix = `r2/surf-photos/${userId}/`;
  return photoPath.startsWith(prefix) && /^photo-\d+-[a-f0-9]{16}\.(jpg|png|heic|heif)$/.test(photoPath.slice(prefix.length));
}

export function validatePhotoPaths(userId: number, photoPaths: string[]) {
  if (new Set(photoPaths).size !== photoPaths.length || !photoPaths.every(path => isR2PhotoPath(userId, path))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "照片路徑不屬於您的帳號或格式不正確" });
  }
}

export function photoViewPath(photoId: number) {
  return `/api/photos/${photoId}`;
}

export function toPhotoView(photo: { id: number }) {
  return { id: photo.id, url: photoViewPath(photo.id) };
}

export async function presignPhoto(userId: number, contentType: keyof typeof PHOTO_TYPES, size: number) {
  if (!hasR2Config()) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "照片儲存服務尚未設定：請設定 R2_ACCOUNT_ID、R2_ACCESS_KEY_ID、R2_SECRET_ACCESS_KEY 與 R2_BUCKET" });
  }
  const photoPath = `r2/surf-photos/${userId}/photo-${Date.now()}-${randomBytes(8).toString("hex")}.${PHOTO_TYPES[contentType]}`;
  await reservePhotoUpload(userId, photoPath);
  const client = createR2Client({ requestChecksumCalculation: "WHEN_REQUIRED" });
  try {
    const uploadUrl = await getSignedUrl(client, new PutObjectCommand({
      Bucket: ENV.r2Bucket,
      Key: photoPath,
      ContentType: contentType,
      ContentLength: size,
    }), { expiresIn: 600, signableHeaders: new Set(["content-type"]) });
    return { uploadUrl, photoPath };
  } finally {
    client.destroy();
  }
}

export async function presignPhotoView(userId: number, photoPath: string) {
  if (!isR2PhotoPath(userId, photoPath)) throw new Error("Not an R2 session photo");
  if (!hasR2Config()) throw new Error("R2 photo viewing is not configured");
  const client = createR2Client();
  try {
    return await getSignedUrl(client, new GetObjectCommand({ Bucket: ENV.r2Bucket, Key: photoPath }),
      { expiresIn: PLAYBACK_URL_TTL_SECONDS });
  } finally {
    client.destroy();
  }
}

export async function deleteR2Photo(userId: number, photoPath: string): Promise<boolean> {
  if (!isR2PhotoPath(userId, photoPath)) return false;
  if (!hasR2Config()) throw new Error("R2 photo deletion is not configured");
  const client = createR2Client();
  try {
    await client.send(new DeleteObjectCommand({ Bucket: ENV.r2Bucket, Key: photoPath }));
    return true;
  } finally {
    client.destroy();
  }
}

// Best effort: a failed R2 delete leaves an orphaned object but never blocks the user's edit.
export async function deleteUnreferencedPhotos(userId: number, photoPaths: string[]) {
  for (const photoPath of photoPaths) {
    try {
      if (!await isPhotoPathReferenced(photoPath)) await deleteR2Photo(userId, photoPath);
    } catch (error) {
      console.error("[R2] Failed to delete session photo:", error);
    }
  }
}

export const photoViewRouter = Router();

photoViewRouter.get("/:photoId", async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  res.set("Referrer-Policy", "no-referrer");

  let viewer: User;
  try {
    viewer = await sdk.authenticateRequest(req);
  } catch {
    res.status(401).json({ error: "請先登入" });
    return;
  }

  const photoId = Number(req.params.photoId);
  if (!Number.isSafeInteger(photoId) || photoId <= 0) {
    res.status(404).json({ error: "找不到照片" });
    return;
  }

  try {
    const photo = await getSessionPhoto(photoId);
    if (!photo || !await canViewSessionVideo(viewer, { id: photo.sessionId, userId: photo.userId })) {
      res.status(404).json({ error: "找不到照片" });
      return;
    }
    res.redirect(302, await presignPhotoView(photo.userId, photo.photoPath));
  } catch (error) {
    console.error("[R2] Failed to prepare photo view:", error);
    res.status(500).json({ error: "照片暫時無法顯示，請稍後再試" });
  }
});
