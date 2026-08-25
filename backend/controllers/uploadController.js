import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2, BUCKET_NAME, PUBLIC_URL } from "../config/r2.js";

export async function uploadFile(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided" });

    const key = `uploads/${Date.now()}-${req.file.originalname.replace(/\s+/g, "_")}`;

    await r2.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }));

    const url = `${PUBLIC_URL}/${key}`;
    res.json({ url, name: req.file.originalname, size: req.file.size, type: req.file.mimetype });
  } catch (err) {
    console.error("R2 upload failed:", err);
    res.status(500).json({ error: "Failed to upload file" });
  }
}