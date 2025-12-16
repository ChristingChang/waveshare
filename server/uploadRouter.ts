import { Router } from "express";
import multer from "multer";
import { storagePut } from "./storage";
import { randomBytes } from "crypto";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
});

router.post("/upload-video", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const file = req.file;
    const randomSuffix = randomBytes(8).toString("hex");
    const fileExt = file.originalname.split(".").pop() || "mp4";
    const fileName = `video-${Date.now()}-${randomSuffix}.${fileExt}`;
    const filePath = `surf-videos/${fileName}`;

    // Upload to S3
    const result = await storagePut(
      filePath,
      file.buffer,
      file.mimetype
    );

    res.json({
      url: result.url,
      path: filePath,
    });
  } catch (error) {
    console.error("Video upload error:", error);
    res.status(500).json({ error: "Upload failed" });
  }
});

export default router;
