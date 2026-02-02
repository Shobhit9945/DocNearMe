import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { supportedLanguages } from "@/lib/translations";

interface LanguageSwitcherProps {
  className?: string;
}

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { language, setLanguage, t } = useTranslation();

  return (
    <label
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:border-[#1648CE] hover:text-[#1648CE]",
        className
      )}
    >
      <span className="sr-only">{t("Language", "Language")}</span>
      <Languages className="h-4 w-4" />
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value as typeof language)}
        className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none"
        aria-label={t("Language", "Language")}
      >
        {supportedLanguages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.nativeLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
