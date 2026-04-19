import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { X } from "lucide-react";

interface DocDaisyBannerProps {
  className?: string;
  onClick?: () => void;
  onClose?: () => void;
  variant?: "button" | "card";
}

export function DocDaisyBanner({ className, onClick, onClose, variant = "button" }: DocDaisyBannerProps) {
  const { t } = useTranslation();

  return (
    <div className={cn("relative w-full lg:max-w-[360px]", className)}>
      {onClose && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute -top-2 -right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white text-slate-400 shadow-md transition-colors hover:text-slate-600"
          aria-label={t("Close DocDaisy banner")}
        >
          <X className="h-3 w-3" />
        </button>
      )}
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "w-full bg-[#EEE9FF] border border-[#3A12DB] rounded-[14px] shadow-[0_4px_9px_0_rgba(0,0,0,0.15)] p-4 text-left transition-all duration-200",
          variant === "card" && "lg:p-4 lg:shadow-xl"
        )}
      >
        <div className="flex items-center justify-start gap-0">
          <div className="flex-1 text-left min-w-0 pr-0">
            <h4 className="text-base font-bold text-black leading-tight mb-1">{t("Not sure which clinic to visit?")}</h4>
            <p className="text-xl font-bold bg-gradient-to-r from-[#3A12DB] to-[#7C53FF] bg-clip-text text-transparent leading-tight mb-1">
              DOCDAISY
            </p>
            <p className="text-base font-semibold text-black leading-tight mb-1">{t("is here for you!")}</p>
            <p className="text-sm text-black leading-tight">{t("Click on the banner to ask")}</p>
          </div>
          <img
            src="/docdaisy.avif"
            alt="DocDaisy AI Assistant"
            className="-ml-2 w-[140px] h-[140px] rounded-[14px] object-contain flex-shrink-0 lg:w-[120px] lg:h-[120px]"
          />
        </div>
      </button>
    </div>
  );
}
