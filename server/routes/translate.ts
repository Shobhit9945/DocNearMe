import { RequestHandler } from "express";
import { z } from "zod";

const translationRequestSchema = z.object({
  text: z.string().trim().min(1).max(5000),
  targetLanguage: z.enum(["en", "ja", "vi", "id", "es"]),
  sourceLanguage: z.enum(["auto", "en", "ja", "vi", "id", "es"]).optional().default("auto"),
});

const translateBaseUrl = process.env.DEEPL_API_URL ?? "https://api-free.deepl.com/v2/translate";
const translateApiKey = process.env.DEEPL;

const mapDeepLLanguage = (language: "en" | "ja" | "vi" | "id" | "es") => {
  switch (language) {
    case "en":
      return "EN";
    case "ja":
      return "JA";
    case "vi":
      return "VI";
    case "id":
      return "ID";
    case "es":
      return "ES";
    default:
      return "EN";
  }
};

export const handleTranslate: RequestHandler = async (req, res, next) => {
  try {
    const parsed = translationRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid translation request",
        detail: "invalid_payload",
      });
    }

    if (!translateApiKey) {
      return res.status(500).json({
        error: "Missing DeepL API key",
        detail: "missing_deepl_key",
      });
    }

    const { text, targetLanguage, sourceLanguage } = parsed.data;
    const params = new URLSearchParams();
    params.append("text", text);
    params.append("target_lang", mapDeepLLanguage(targetLanguage));
    if (sourceLanguage && sourceLanguage !== "auto") {
      params.append("source_lang", mapDeepLLanguage(sourceLanguage));
    }

    const response = await fetch(translateBaseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `DeepL-Auth-Key ${translateApiKey}`,
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return res.status(502).json({
        error: "Translation service unavailable",
        detail: "translation_failed",
        message: errorBody,
      });
    }

    const data = (await response.json()) as { translations?: Array<{ text?: string }> };
    return res.json({
      translation: data.translations?.[0]?.text ?? text,
    });
  } catch (error) {
    return next(error);
  }
};
