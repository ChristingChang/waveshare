import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { TRPCError } from "@trpc/server";
import { randomBytes } from "crypto";
import { ENV } from "./_core/env.js";

export const VIDEO_TYPES = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
} as const;
export const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

function publicBaseUrl() {
  try {
    const url = new URL(ENV.r2PublicUrl);
    if (url.protocol !== "https:" || url.search || url.hash) throw new Error();
    return url.toString().replace(/\/+$/, "");
  } catch {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "影片儲存服務尚未設定：請設定有效的 R2_PUBLIC_URL" });
  }
}

function isR2VideoPath(userId: number, videoPath: string) {
  const prefix = `surf-videos/${userId}/`;
  return videoPath.startsWith(prefix) && /^video-\d+-[a-f0-9]{16}\.(mp4|mov|webm)$/.test(videoPath.slice(prefix.length));
}

export function withCurrentVideoUrl<T extends { userId: number; videoPath: string; videoUrl: string }>(session: T): T {
  return isR2VideoPath(session.userId, session.videoPath)
    ? { ...session, videoUrl: `${publicBaseUrl()}/${session.videoPath}` }
    : session;
}

export function validateVideoReference(userId: number, videoPath: string, videoUrl: string) {
  if (!isR2VideoPath(userId, videoPath)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "影片路徑不屬於您的帳號或格式不正確" });
  }
  if (videoUrl !== `${publicBaseUrl()}/${videoPath}`) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "影片網址與儲存路徑不符" });
  }
}

export async function presignVideo(userId: number, contentType: keyof typeof VIDEO_TYPES, size: number) {
  if (!ENV.r2AccountId || !ENV.r2AccessKeyId || !ENV.r2SecretAccessKey || !ENV.r2Bucket) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "影片儲存服務尚未設定：請設定 R2_ACCOUNT_ID、R2_ACCESS_KEY_ID、R2_SECRET_ACCESS_KEY 與 R2_BUCKET" });
  }
  const baseUrl = publicBaseUrl();
  const videoPath = `surf-videos/${userId}/video-${Date.now()}-${randomBytes(8).toString("hex")}.${VIDEO_TYPES[contentType]}`;
  const client = new S3Client({
    endpoint: `https://${ENV.r2AccountId}.r2.cloudflarestorage.com`,
    region: "auto",
    requestChecksumCalculation: "WHEN_REQUIRED",
    credentials: { accessKeyId: ENV.r2AccessKeyId, secretAccessKey: ENV.r2SecretAccessKey },
  });
  try {
    const uploadUrl = await getSignedUrl(client, new PutObjectCommand({
      Bucket: ENV.r2Bucket,
      Key: videoPath,
      ContentType: contentType,
      ContentLength: size,
    }), { expiresIn: 600, signableHeaders: new Set(["content-type"]) });
    return { uploadUrl, videoPath, videoUrl: `${baseUrl}/${videoPath}` };
  } finally {
    client.destroy();
  }
}
