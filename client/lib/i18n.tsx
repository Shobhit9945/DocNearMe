import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { translations, Language, supportedLanguages } from "./translations";

interface TranslationContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
}

const TranslationContext = createContext<TranslationContextValue | null>(null);

interface TranslationProviderProps {
  children: ReactNode;
  defaultLanguage?: Language;
  storageKey?: string;
}

const AUTO_TRANSLATION_CACHE_PREFIX = "dnm-translation-cache";

const TARGET_LANGUAGE_MAP: Record<Language, string | null> = {
  en: "en",
  ja: "ja",
  id: "id",
  my: "my",
  bn: "bn",
  ar: "ar",
  hi: "hi",
  fil: "fil",
  th: "th",
  zh: "zh",
  ko: "ko",
  "es-MX": "es",
  vi: "vi",
};

const getCacheKey = (language: Language) => `${AUTO_TRANSLATION_CACHE_PREFIX}:${language}`;

function getInitialLanguage(defaultLanguage: Language, storageKey: string): Language {
  if (typeof localStorage !== "undefined") {
    const saved = localStorage.getItem(storageKey);
    const match = supportedLanguages.find((lang) => lang.code === saved);
    if (match) return match.code;
  }
  return defaultLanguage;
}

export function TranslationProvider({
  children,
  defaultLanguage = "en",
  storageKey = "dnm-language",
}: TranslationProviderProps) {
  const [language, setLanguage] = useState<Language>(() => getInitialLanguage(defaultLanguage, storageKey));
  const [cacheVersion, setCacheVersion] = useState(0);
  const cacheRef = useRef<Record<string, string>>({});
  const pendingRef = useRef<Set<string>>(new Set());
  const inFlightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(storageKey, language);
    }
  }, [language, storageKey]);

  useEffect(() => {
    if (typeof localStorage === "undefined") {
      cacheRef.current = {};
      setCacheVersion((prev) => prev + 1);
      return;
    }

    try {
      const raw = localStorage.getItem(getCacheKey(language));
      cacheRef.current = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      cacheRef.current = {};
    }
    setCacheVersion((prev) => prev + 1);
  }, [language]);

  useEffect(() => {
    if (language === "en") return;
    const queue = Array.from(pendingRef.current);
    if (!queue.length) return;
    pendingRef.current.clear();

    let cancelled = false;

    const translateQueue = async () => {
      for (const key of queue) {
        if (cancelled) return;
        if (inFlightRef.current.has(key)) continue;
        inFlightRef.current.add(key);

        const entry = translations[key];
        const sourceText = entry?.en ?? key;
        const targetLanguage = TARGET_LANGUAGE_MAP[language];
        if (!targetLanguage || !sourceText.trim()) {
          inFlightRef.current.delete(key);
          continue;
        }

        try {
          const response = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: sourceText,
              targetLanguage,
              sourceLanguage: "en",
            }),
          });

          if (!response.ok) {
            inFlightRef.current.delete(key);
            continue;
          }

          const data = (await response.json()) as { translation?: string };
          const translated = data.translation?.trim();
          if (!translated) {
            inFlightRef.current.delete(key);
            continue;
          }

          cacheRef.current = { ...cacheRef.current, [key]: translated };
          if (typeof localStorage !== "undefined") {
            localStorage.setItem(getCacheKey(language), JSON.stringify(cacheRef.current));
          }
          setCacheVersion((prev) => prev + 1);
        } catch {
          // ignore translation failures
        } finally {
          inFlightRef.current.delete(key);
        }
      }
    };

    translateQueue();

    return () => {
      cancelled = true;
    };
  }, [cacheVersion, language]);

  const t = useMemo(
    () =>
      (key: string, fallback?: string) => {
        const entry = translations[key];
        if (entry?.[language]) return entry[language] as string;
        if (language === "en") return entry?.en ?? fallback ?? key;

        const cached = cacheRef.current[key];
        if (cached) return cached;

        if (!pendingRef.current.has(key)) {
          pendingRef.current.add(key);
        }

        return entry?.en ?? fallback ?? key;
      },
    [language, cacheVersion]
  );

  const toggleLanguage = () => {
    setLanguage((prev) => {
      const index = supportedLanguages.findIndex((item) => item.code === prev);
      if (index === -1) return "en";
      const next = supportedLanguages[(index + 1) % supportedLanguages.length];
      return next.code;
    });
  };

  const value = useMemo(
    () => ({ language, setLanguage, toggleLanguage, t }),
    [language, t]
  );

  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
}

export function useTranslation() {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error("useTranslation must be used within a TranslationProvider");
  }
  return context;
}
