import { RequestHandler } from "express";
import { z } from "zod";

const normalizeLanguageInput = (value: unknown) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  if (normalized === "es-mx") return "es";
  if (normalized === "zh-cn" || normalized === "zh-tw") return "zh";
  if (normalized === "tl") return "fil";
  if (normalized === "jp") return "ja";
  return normalized;
};

const normalizeTextInput = (value: unknown) => {
  if (typeof value !== "string") return value;
  return value.trim();
};

const languageSchema = z.preprocess(
  normalizeLanguageInput,
  z.enum(["en", "ja", "ko", "id", "my", "bn", "ar", "hi", "th", "fil", "zh", "es", "vi"]),
);

const translationRequestSchema = z.object({
  text: z.preprocess(normalizeTextInput, z.string().min(1).max(5000)),
  targetLanguage: languageSchema,
  sourceLanguage: z
    .preprocess(
      normalizeLanguageInput,
      z.enum(["auto", "en", "ja", "ko", "id", "my", "bn", "ar", "hi", "th", "fil", "zh", "es", "vi"]),
    )
    .optional()
    .default("auto"),
});

const parseRequestBody = (body: unknown): unknown => {
  if (body instanceof Buffer) {
    return parseRequestBody(body.toString("utf8"));
  }
  if (body instanceof Uint8Array) {
    return parseRequestBody(Buffer.from(body).toString("utf8"));
  }
  if (body && typeof body === "object") return body;
  if (typeof body !== "string") return {};

  const trimmed = body.trim();
  if (!trimmed) return {};

  try {
    return JSON.parse(trimmed);
  } catch {
    const params = new URLSearchParams(trimmed);
    const payload: Record<string, string> = {};
    params.forEach((value, key) => {
      payload[key] = value;
    });
    return payload;
  }
};

const translateBaseUrl = process.env.DEEPL_API_URL ?? "https://api-free.deepl.com/v2/translate";
const translateApiKey = process.env.DEEPL;
const googleTranslateBaseUrl = "https://translate.googleapis.com/translate_a/single";

const mapDeepLLanguage = (language: "en" | "ja" | "ko" | "id" | "ar" | "hi" | "th" | "zh" | "vi" | "es") => {
  switch (language) {
    case "en":
      return "EN";
    case "ja":
      return "JA";
    case "ko":
      return "KO";
    case "vi":
      return "VI";
    case "id":
      return "ID";
    case "ar":
      return "AR";
    case "hi":
      return "HI";
    case "th":
      return "TH";
    case "zh":
      return "ZH";
    case "es":
      return "ES";
    default:
      return "EN";
  }
};

const mapGoogleLanguage = (
  language: "en" | "ja" | "ko" | "id" | "my" | "bn" | "ar" | "hi" | "th" | "fil" | "zh" | "es" | "vi",
) => {
  if (language === "fil") return "tl";
  return language;
};

const isDeepLSupported = (
  language: "en" | "ja" | "ko" | "id" | "my" | "bn" | "ar" | "hi" | "th" | "fil" | "zh" | "es" | "vi",
) => ["en", "ja", "ko", "id", "ar", "hi", "th", "zh", "es", "vi"].includes(language);

const translateWithGoogle = async (
  text: string,
  targetLanguage: "en" | "ja" | "ko" | "id" | "my" | "bn" | "ar" | "hi" | "th" | "fil" | "zh" | "es" | "vi",
  sourceLanguage: "auto" | "en" | "ja" | "ko" | "id" | "my" | "bn" | "ar" | "hi" | "th" | "fil" | "zh" | "es" | "vi",
) => {
  const target = mapGoogleLanguage(targetLanguage);
  const source = sourceLanguage === "auto" ? "auto" : mapGoogleLanguage(sourceLanguage);
  const url = new URL(googleTranslateBaseUrl);
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", source);
  url.searchParams.set("tl", target);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", text);
  const response = await fetch(url.toString());
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody);
  }
  const data = (await response.json()) as Array<Array<[string]>> | undefined;
  const translated = data?.[0]?.map((chunk) => chunk[0]).join("").trim();
  return translated || text;
};

export const handleTranslate: RequestHandler = async (req, res, next) => {
  try {
    const parsed = translationRequestSchema.safeParse(parseRequestBody(req.body));
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid translation request",
        detail: "invalid_payload",
      });
    }

    const { text, targetLanguage, sourceLanguage } = parsed.data;

    if (!translateApiKey || !isDeepLSupported(targetLanguage)) {
      try {
        const translation = await translateWithGoogle(text, targetLanguage, sourceLanguage);
        return res.json({ translation });
      } catch (error) {
        return res.status(502).json({
          error: "Translation service unavailable",
          detail: "translation_failed",
          message: error instanceof Error ? error.message : "Google translation failed",
        });
      }
    }
    const params = new URLSearchParams();
    params.append("text", text);
    params.append("target_lang", mapDeepLLanguage(targetLanguage));
    if (sourceLanguage && sourceLanguage !== "auto" && isDeepLSupported(sourceLanguage)) {
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
