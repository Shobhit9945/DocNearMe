import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Globe2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { supportedLanguages } from "@/lib/translations";

const resolveLanguageLabel = (languageCode: string) => {
  const match = supportedLanguages.find((entry) => entry.code === languageCode);
  return match?.nativeLabel ?? languageCode.toUpperCase();
};

export function LanguageTransitionOverlay() {
  const { language, isTranslating } = useTranslation();
  const languageLabel = useMemo(() => resolveLanguageLabel(language), [language]);

  return (
    <AnimatePresence>
      {isTranslating && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[120] overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          <div className="dnm-language-overlay-backdrop absolute inset-0" />
          <div className="dnm-language-overlay-grid absolute inset-0" />
          <div className="relative z-10 flex h-full items-center justify-center px-6">
            <motion.div
              className="w-full max-w-sm rounded-3xl border border-white/50 bg-white/80 p-5 shadow-[0_18px_60px_rgba(0,45,85,0.2)] backdrop-blur-md"
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
            >
              <div className="flex items-center gap-3">
                <div className="dnm-language-chip rounded-2xl bg-[#E8F4FF] p-2 text-[#005EA8]">
                  <Globe2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#003B6D]">Updating interface language</p>
                  <p className="text-xs text-slate-600">Applying {languageLabel}</p>
                </div>
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#D7E9F8]">
                <motion.div
                  className="h-full w-1/2 rounded-full bg-[#0089FF]"
                  animate={{ x: ["-110%", "210%"] }}
                  transition={{ duration: 1.15, ease: "easeInOut", repeat: Infinity }}
                />
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
