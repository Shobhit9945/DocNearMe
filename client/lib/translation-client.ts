import { useQuery } from "@tanstack/react-query";
import type { TranslateRequest, TranslateResponse } from "@shared/api";
import type { Language } from "./translations";

const TARGET_LANGUAGE_MAP: Record<Language, TranslateRequest["targetLanguage"] | null> = {
  en: "en",
  ja: "ja",
  vi: "vi",
  id: "id",
  "es-MX": "es",
  my: null,
  bn: null,
  ar: null,
  hi: null,
  fil: null,
  th: null,
  zh: null,
  ko: null,
};
const JAPANESE_REGEX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9faf\uf900-\ufaff]/;
const LATIN_REGEX = /[A-Za-z]/;

const detectLanguage = (text: string): "ja" | "en" | "unknown" => {
  if (JAPANESE_REGEX.test(text)) return "ja";
  if (LATIN_REGEX.test(text)) return "en";
  return "unknown";
};

const shouldTranslate = (text: string, targetLanguage: Language, enabled: boolean) => {
  if (!text.trim()) return false;
  if (!enabled) return false;
  if (!TARGET_LANGUAGE_MAP[targetLanguage]) return false;
  const detected = detectLanguage(text);
  if (detected === "unknown") return false;
  return detected !== targetLanguage;
};

export const useTranslatedText = (text: string, targetLanguage: Language, enabled = true) => {
  const normalizedText = text.trim();
  const needsTranslation = shouldTranslate(normalizedText, targetLanguage, enabled);
  const resolvedTargetLanguage = TARGET_LANGUAGE_MAP[targetLanguage] ?? "en";

  const query = useQuery({
    queryKey: ["translate", normalizedText, resolvedTargetLanguage],
    queryFn: async (): Promise<string> => {
      const detectedLanguage = detectLanguage(normalizedText);
      const payload: TranslateRequest = {
        text: normalizedText,
        targetLanguage: resolvedTargetLanguage,
        sourceLanguage: detectedLanguage === "ja" ? "ja" : "auto",
      };

      const response = await fetch("/api/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Translation failed");
      }

      const data = (await response.json()) as TranslateResponse;
      return data.translation ?? normalizedText;
    },
    enabled: needsTranslation,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 12,
  });

  return {
    translation: needsTranslation ? query.data : undefined,
    isLoading: query.isLoading,
  };
};
