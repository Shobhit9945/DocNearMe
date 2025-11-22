import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

interface LanguageSwitcherProps {
  className?: string;
}

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { language, toggleLanguage, t } = useTranslation();
  const isJapanese = language === "ja";

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:border-[#1648CE] hover:text-[#1648CE]",
        className
      )}
      aria-label={isJapanese ? t("Switch to English", "Switch to English") : t("Switch to Japanese", "Switch to Japanese")}
    >
      <Languages className="h-4 w-4" />
      <span>{isJapanese ? "日本語" : "English"}</span>
    </button>
  );
}
