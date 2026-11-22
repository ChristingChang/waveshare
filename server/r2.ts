import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { TRPCError } from "@trpc/server";
import { randomBytes } from "crypto";
import { ENV } from "./_core/env.js";
import { reserveVideoUpload } from "./videoUploads.js";

export const VIDEO_TYPES = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
} as const;
export const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

export const PLAYBACK_URL_TTL_SECONDS = 15 * 60;

function hasR2Config() {
  return Boolean(ENV.r2AccountId && ENV.r2AccessKeyId && ENV.r2SecretAccessKey && ENV.r2Bucket);
}

function createR2Client(options: { requestChecksumCalculation?: "WHEN_REQUIRED" } = {}) {
  return new S3Client({
    endpoint: `https://${ENV.r2AccountId}.r2.cloudflarestorage.com`,
    region: "auto",
    ...options,
    credentials: { accessKeyId: ENV.r2AccessKeyId, secretAccessKey: ENV.r2SecretAccessKey },
  });
}

function isR2VideoPath(userId: number, videoPath: string) {
  const prefix = `r2/surf-videos/${userId}/`;
  return videoPath.startsWith(prefix) && /^video-\d+-[a-f0-9]{16}\.(mp4|mov|webm)$/.test(videoPath.slice(prefix.length));
}

export function isR2SessionVideo(session: { userId: number; videoPath: string }) {
  return isR2VideoPath(session.userId, session.videoPath);
}

export function playbackPath(sessionId: number) {
  return `/api/videos/${sessionId}`;
}

export function withPlaybackUrl<T extends { id: number; userId: number; videoPath: string; videoUrl: string }>(session: T): T {
  return { ...session, videoUrl: playbackPath(session.id) };
}

export function validateVideoReference(userId: number, videoPath: string) {
  if (!isR2VideoPath(userId, videoPath)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "影片路徑不屬於您的帳號或格式不正確" });
  }
}

export async function presignVideoPlayback(userId: number, videoPath: string) {
  if (!isR2VideoPath(userId, videoPath)) throw new Error("Not an R2 session video");
  if (!hasR2Config()) throw new Error("R2 video playback is not configured");
  const client = createR2Client();
  try {
    return await getSignedUrl(client, new GetObjectCommand({ Bucket: ENV.r2Bucket, Key: videoPath }),
      { expiresIn: PLAYBACK_URL_TTL_SECONDS });
  } finally {
    client.destroy();
  }
}

export async function deleteR2Video(userId: number, videoPath: string): Promise<boolean> {
  if (!isR2VideoPath(userId, videoPath)) return false;
  if (!hasR2Config()) throw new Error("R2 video deletion is not configured");
  const client = createR2Client();
  try {
    await client.send(new DeleteObjectCommand({ Bucket: ENV.r2Bucket, Key: videoPath }));
    return true;
  } finally {
    client.destroy();
  }
}

export async function presignVideo(userId: number, contentType: keyof typeof VIDEO_TYPES, size: number) {
  if (!hasR2Config()) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "影片儲存服務尚未設定：請設定 R2_ACCOUNT_ID、R2_ACCESS_KEY_ID、R2_SECRET_ACCESS_KEY 與 R2_BUCKET" });
  }
  const videoPath = `r2/surf-videos/${userId}/video-${Date.now()}-${randomBytes(8).toString("hex")}.${VIDEO_TYPES[contentType]}`;
  await reserveVideoUpload(userId, videoPath);
  const client = createR2Client({ requestChecksumCalculation: "WHEN_REQUIRED" });
  try {
    const uploadUrl = await getSignedUrl(client, new PutObjectCommand({
      Bucket: ENV.r2Bucket,
      Key: videoPath,
      ContentType: contentType,
      ContentLength: size,
    }), { expiresIn: 600, signableHeaders: new Set(["content-type"]) });
    return { uploadUrl, videoPath };
  } finally {
    client.destroy();
  }
}
