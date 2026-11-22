import { Router } from "express";
import type { User } from "../drizzle/schema.js";
import { sdk } from "./_core/sdk.js";
import { canFriendViewSession, getSessionVideo } from "./db.js";
import { isR2SessionVideo, presignVideoPlayback } from "./r2.js";

type SessionVideo = { id: number; userId: number; videoPath: string; videoUrl: string };

export async function canViewSessionVideo(viewer: Pick<User, "id">, session: Pick<SessionVideo, "id" | "userId">, lookup = canFriendViewSession) {
  return viewer.id === session.userId || await lookup(session.id, viewer.id);
}

export const videoPlaybackRouter = Router();

videoPlaybackRouter.get("/:sessionId", async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  res.set("Referrer-Policy", "no-referrer");

  let viewer: User;
  try {
    viewer = await sdk.authenticateRequest(req);
  } catch {
    res.status(401).json({ error: "請先登入" });
    return;
  }

  const sessionId = Number(req.params.sessionId);
  if (!Number.isSafeInteger(sessionId) || sessionId <= 0) {
    res.status(404).json({ error: "找不到影片" });
    return;
  }

  try {
    const session = await getSessionVideo(sessionId);
    if (!session || !await canViewSessionVideo(viewer, session)) {
      res.status(404).json({ error: "找不到影片" });
      return;
    }
    if (isR2SessionVideo(session)) {
      res.redirect(302, await presignVideoPlayback(session.userId, session.videoPath));
      return;
    }
    if (/^https:\/\//.test(session.videoUrl)) {
      res.redirect(302, session.videoUrl);
      return;
    }
    res.status(404).json({ error: "找不到影片" });
  } catch (error) {
    console.error("[R2] Failed to prepare video playback:", error);
    res.status(500).json({ error: "影片暫時無法播放，請稍後再試" });
  }
});
