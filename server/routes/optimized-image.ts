import crypto from "crypto";
import { RequestHandler } from "express";
import sharp from "sharp";
import { getOptimizedImagesCollection } from "../db";

const MAX_SOURCE_IMAGE_BYTES = 12 * 1024 * 1024;
const DEFAULT_AVIF_QUALITY = 60;

const isPrivateHostname = (hostname: string) => {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized === "localhost" || normalized === "::1") return true;
  if (/^127\./.test(normalized) || /^10\./.test(normalized) || /^192\.168\./.test(normalized)) {
    return true;
  }
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)) return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:")) {
    return true;
  }
  return false;
};

const isAllowedRemoteImageUrl = (value: string) => {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (isPrivateHostname(url.hostname)) return false;
    return true;
  } catch {
    return false;
  }
};

const hashUrl = (url: string) => crypto.createHash("sha256").update(url).digest("hex");

export const handleOptimizedImage: RequestHandler = async (req, res) => {
  const sourceUrl = typeof req.query.src === "string" ? req.query.src.trim() : "";
  if (!sourceUrl) {
    return res.status(400).json({ error: "Image source URL is required." });
  }

  if (!isAllowedRemoteImageUrl(sourceUrl)) {
    return res.status(400).json({ error: "Only public http or https image URLs are allowed." });
  }

  const sourceUrlHash = hashUrl(sourceUrl);
  const cache = await getOptimizedImagesCollection();
  const cached = await cache.findOne({ sourceUrlHash });
  if (cached?.avifData) {
    res.setHeader("Content-Type", cached.contentType || "image/avif");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("X-DocNearMe-Image-Cache", "hit");
    return res.send(Buffer.from(cached.avifData, "base64"));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(sourceUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "image/*,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      return res.status(502).json({ error: "Unable to fetch image." });
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return res.status(415).json({ error: "Source URL did not return an image." });
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_SOURCE_IMAGE_BYTES) {
      return res.status(413).json({ error: "Image is too large to optimize." });
    }

    const avifBuffer = await sharp(Buffer.from(bytes)).rotate().avif({ quality: DEFAULT_AVIF_QUALITY, effort: 6 }).toBuffer();
    const now = new Date();
    const existingEntry = await cache.findOne({ sourceUrlHash });
    if (existingEntry) {
      await cache.updateOne(
        { sourceUrlHash },
        {
          $set: {
            sourceUrl,
            sourceUrlHash,
            contentType: "image/avif",
            avifData: avifBuffer.toString("base64"),
            byteLength: avifBuffer.byteLength,
            updatedAt: now,
          },
        },
      );
    } else {
      await cache.insertOne({
        sourceUrl,
        sourceUrlHash,
        contentType: "image/avif",
        avifData: avifBuffer.toString("base64"),
        byteLength: avifBuffer.byteLength,
        createdAt: now,
        updatedAt: now,
      });
    }

    res.setHeader("Content-Type", "image/avif");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("X-DocNearMe-Image-Cache", "miss");
    return res.send(avifBuffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("aborted")) {
      return res.status(504).json({ error: "Image optimization timed out." });
    }
    console.error("Optimized image proxy error", error);
    return res.status(500).json({ error: "Failed to optimize image." });
  } finally {
    clearTimeout(timeout);
  }
};