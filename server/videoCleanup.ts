import { and, eq, notExists, sql } from "drizzle-orm";
import { photoUploads, sessionPhotos, surfSessions, videoUploads } from "../drizzle/schema.js";
import { getDb } from "./db.js";
import { deleteR2Photo } from "./photos.js";
import { deleteR2Video } from "./r2.js";

export async function cleanupUnusedVideos() {
  const db = await getDb();
  if (!db) throw new Error("Video cleanup database unavailable");
  const uploads = await db.select().from(videoUploads).where(and(
    sql`${videoUploads.createdAt} < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 24 HOUR)`,
    notExists(db.select({ id: surfSessions.id }).from(surfSessions).where(eq(surfSessions.videoPath, videoUploads.videoPath))),
  )).limit(100);
  let deleted = 0;
  let failed = 0;
  for (const upload of uploads) {
    try {
      if (!await deleteR2Video(upload.userId, upload.videoPath)) continue;
      await db.delete(videoUploads).where(eq(videoUploads.id, upload.id));
      deleted++;
    } catch (error) {
      failed++;
      console.error("[R2] Failed to clean up unused video:", error);
    }
  }
  return { scanned: uploads.length, deleted, failed };
}

export async function cleanupUnusedPhotos() {
  const db = await getDb();
  if (!db) throw new Error("Photo cleanup database unavailable");
  const uploads = await db.select().from(photoUploads).where(and(
    sql`${photoUploads.createdAt} < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 24 HOUR)`,
    notExists(db.select({ id: sessionPhotos.id }).from(sessionPhotos).where(eq(sessionPhotos.photoPath, photoUploads.photoPath))),
  )).limit(100);
  let deleted = 0;
  let failed = 0;
  for (const upload of uploads) {
    try {
      if (!await deleteR2Photo(upload.userId, upload.photoPath)) continue;
      await db.delete(photoUploads).where(eq(photoUploads.id, upload.id));
      deleted++;
    } catch (error) {
      failed++;
      console.error("[R2] Failed to clean up unused photo:", error);
    }
  }
  return { scanned: uploads.length, deleted, failed };
}
