import { Router } from "express";
import multer from "multer";
import { storagePut } from "./storage.js";
import { randomBytes } from "crypto";
import { sdk } from "./_core/sdk.js";

function getVideoExtension(buffer: Buffer): string | undefined {
  if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp") {
    const brand = buffer.toString("ascii", 8, 12);
    if (brand === "qt  ") return "mov";
    if (/^(isom|iso[2-9]|mp4[12]|avc1|M4V |MSNV|dash)$/.test(brand)) return "mp4";
  }
  if (
    buffer.length >= 4 &&
    buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) &&
    buffer.subarray(4, 4096).includes(Buffer.from("webm"))
  ) return "webm";
  return undefined;
}

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
});

router.post("/upload-video", async (req, res, next) => {
  try {
    res.locals.user = await sdk.authenticateRequest(req);
  } catch {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const file = req.file;
    const fileExt = getVideoExtension(file.buffer);
    if (!file.mimetype.startsWith("video/") || !fileExt) {
      return res.status(400).json({ error: "Unsupported video file" });
    }
    const randomSuffix = randomBytes(8).toString("hex");
    const fileName = `video-${Date.now()}-${randomSuffix}.${fileExt}`;
    const filePath = `surf-videos/${res.locals.user.id}/${fileName}`;

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
