import { useTranslation } from "@/lib/i18n";
import { useTranslatedText } from "@/lib/translation-client";
import { cn } from "@/lib/utils";
import type { Language } from "@/lib/translations";

interface TranslatedTextProps {
  text?: string;
  translatedText?: string;
  className?: string;
  secondaryClassName?: string;
  inline?: boolean;
  showOriginal?: boolean;
  targetLanguage?: Language;
  asText?: boolean;
}

export function TranslatedText({
  text,
  translatedText,
  className,
  secondaryClassName,
  inline = false,
  showOriginal = true,
  targetLanguage,
  asText = false,
}: TranslatedTextProps) {
  const { language } = useTranslation();
  const normalizedText = text?.trim() ?? "";
  const normalizedTranslation = translatedText?.trim() ?? "";
  const resolvedTargetLanguage = targetLanguage ?? language;
  const shouldUseProvidedTranslation = Boolean(normalizedTranslation && resolvedTargetLanguage === "ja");
  const { translation: fetchedTranslation } = useTranslatedText(
    normalizedText,
    resolvedTargetLanguage,
    !shouldUseProvidedTranslation,
  );
  const primaryText = shouldUseProvidedTranslation ? normalizedTranslation : fetchedTranslation || normalizedText;
  const showSecondary = Boolean(showOriginal && primaryText && normalizedText && primaryText !== normalizedText);

  if (!normalizedText) return null;

  if (asText) {
    return showSecondary ? `${primaryText} (${normalizedText})` : primaryText;
  }

  if (!showSecondary) {
    return <span className={className}>{primaryText}</span>;
  }

  if (inline) {
    return (
      <span className={className}>
        {primaryText} <span className={cn("text-xs text-slate-500", secondaryClassName)}>({normalizedText})</span>
      </span>
    );
  }

  return (
    <span className={cn("flex flex-col", className)}>
      <span>{primaryText}</span>
      <span className={cn("text-xs text-slate-500", secondaryClassName)}>{normalizedText}</span>
    </span>
  );
}
