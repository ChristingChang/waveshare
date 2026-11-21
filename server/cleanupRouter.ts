import { Router } from "express";
import { ENV } from "./_core/env.js";
import { cleanupUnusedVideos } from "./videoCleanup.js";

export const cleanupRouter = Router();

cleanupRouter.get("/cleanup-videos", async (req, res) => {
  if (!ENV.cronSecret) {
    res.status(503).json({ error: "Video cleanup is not configured" });
    return;
  }
  if (req.get("authorization") !== `Bearer ${ENV.cronSecret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    res.json(await cleanupUnusedVideos());
  } catch (error) {
    console.error("[R2] Video cleanup failed:", error);
    res.status(500).json({ error: "Video cleanup failed" });
  }
});
