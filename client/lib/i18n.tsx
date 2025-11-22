import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { translations, Language } from "./translations";

interface TranslationContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
}

const TranslationContext = createContext<TranslationContextValue | null>(null);

function getInitialLanguage(): Language {
  if (typeof localStorage !== "undefined") {
    const saved = localStorage.getItem("dnm-language");
    if (saved === "ja" || saved === "en") return saved;
  }
  return "en";
}

export function TranslationProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("dnm-language", language);
    }
  }, [language]);

  const t = useMemo(
    () =>
      (key: string, fallback?: string) => {
        const entry = translations[key];
        if (language === "ja" && entry?.ja) return entry.ja;
        if (language === "en" && entry?.en) return entry.en;
        return fallback ?? key;
      },
    [language]
  );

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === "en" ? "ja" : "en"));
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
