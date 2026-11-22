import { and, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { photoUploads, users, videoUploads } from "../drizzle/schema.js";
import { getDb, rethrowPhotoWriteError } from "./db.js";

export const DAILY_UPLOAD_LIMIT = 10;
export const DAILY_PHOTO_UPLOAD_LIMIT = 100;

export async function reserveVideoUpload(userId: number, videoPath: string) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "影片上傳服務暫時無法使用，請稍後再試" });
  await db.transaction(async tx => {
    const owner = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
    if (!owner.length) throw new TRPCError({ code: "UNAUTHORIZED" });
    const recent = await tx.select({ id: videoUploads.id }).from(videoUploads).where(and(
      eq(videoUploads.userId, userId),
      sql`${videoUploads.createdAt} > DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 24 HOUR)`,
    )).for("update");
    if (recent.length >= DAILY_UPLOAD_LIMIT) {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `影片上傳已達每 24 小時 ${DAILY_UPLOAD_LIMIT} 次的上限，請稍後再試。未完成的上傳也會計入次數。` });
    }
    await tx.insert(videoUploads).values({ userId, videoPath });
  });
}

export async function reservePhotoUpload(userId: number, photoPath: string) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "照片上傳服務暫時無法使用，請稍後再試" });
  await db.transaction(async tx => {
    const owner = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
    if (!owner.length) throw new TRPCError({ code: "UNAUTHORIZED" });
    const recent = await tx.select({ id: photoUploads.id }).from(photoUploads).where(and(
      eq(photoUploads.userId, userId),
      sql`${photoUploads.createdAt} > DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 24 HOUR)`,
    )).for("update");
    if (recent.length >= DAILY_PHOTO_UPLOAD_LIMIT) {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `照片上傳已達每 24 小時 ${DAILY_PHOTO_UPLOAD_LIMIT} 張的上限，請稍後再試。` });
    }
    await tx.insert(photoUploads).values({ userId, photoPath });
  }).catch(rethrowPhotoWriteError);
}
