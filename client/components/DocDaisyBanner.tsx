import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

interface DocDaisyBannerProps {
  className?: string;
  onClick?: () => void;
  variant?: "button" | "card";
}

export function DocDaisyBanner({ className, onClick, variant = "button" }: DocDaisyBannerProps) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full bg-[#EEE9FF] border border-[#3A12DB] rounded-[14px] shadow-[0_4px_9px_0_rgba(0,0,0,0.15)] p-4 text-left transition-all duration-200",
        variant === "card" && "lg:p-6 lg:shadow-xl",
        className
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 text-left min-w-0">
          <h4 className="text-sm font-bold text-black leading-tight mb-1">{t("Have any queries?")}</h4>
          <p className="text-lg font-bold bg-gradient-to-r from-[#3A12DB] to-[#7C53FF] bg-clip-text text-transparent leading-tight mb-1">
            DOCDAISY
          </p>
          <p className="text-sm font-semibold text-black leading-tight mb-1">{t("is here for you!")}</p>
          <p className="text-xs text-black leading-tight">{t("Click on the banner to ask")}</p>
        </div>
        <img
          src="https://api.builder.io/api/v1/image/assets/TEMP/df6e44a93787679647c1cbdaa440c62c2e37e816?width=110"
          alt="DocDaisy AI Assistant"
          className="w-[60px] h-[60px] rounded-[14px] object-cover flex-shrink-0"
        />
      </div>
    </button>
  );
}
