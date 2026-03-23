import { Router, Request, Response } from "express";

const router = Router();

const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com").replace(/\/$/, "");
const VISION_MODEL = process.env.VISION_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4o";

const getApiKey = () => process.env.OPENAI_API_KEY;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

router.post("/translate", async (req: Request, res: Response): Promise<void> => {
  const { base64, mimeType, fileName } = req.body as {
    base64?: string;
    mimeType?: string;
    fileName?: string;
  };

  if (!base64 || typeof base64 !== "string") {
    res.status(400).json({ success: false, message: "base64 is required." });
    return;
  }
  if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
    res.status(400).json({ success: false, message: "Unsupported file type." });
    return;
  }

  // PDFs cannot be sent as vision input — return a placeholder
  if (mimeType === "application/pdf") {
    res.json({
      success: true,
      translated: `[PDF Translation]\nファイル名: ${fileName ?? "document.pdf"}\n\nPDFの自動翻訳は現在サポートされていません。画像ファイル（JPEG、PNG、WebP）をアップロードしてください。`,
    });
    return;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    res.status(503).json({ success: false, message: "Translation service not configured." });
    return;
  }

  try {
    const response = await fetch(`${OPENAI_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please extract all text from this medical document image and translate it into Japanese. Preserve the structure as much as possible. Return only the translated text.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[document-translate] Vision API error:", response.status, errorText);
      res.status(502).json({ success: false, message: "Translation service error." });
      return;
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const translated = json.choices?.[0]?.message?.content ?? "";

    res.json({ success: true, translated });
  } catch (err) {
    console.error("[document-translate] Error:", err);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

export default router;
