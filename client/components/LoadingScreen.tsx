import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type LoadingScreenProps = {
  title?: string;
  subtitle?: string;
  className?: string;
};

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  title = "Loading clinics",
  subtitle = "Fetching the latest availability from nearby providers.",
  className,
}) => {
  return (
    <div className={cn("flex min-h-[60vh] w-full items-center justify-center px-4", className)}>
      <div className="w-full max-w-lg rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#E5DEFF] text-[#3A12DB] shadow-sm">
            🌼
          </div>
          <div>
            <p className="text-base font-semibold text-slate-800">{title}</p>
            <p className="text-sm text-slate-500">{subtitle}</p>
          </div>
          <Loader2 className="ml-auto h-5 w-5 animate-spin text-[#3A12DB]" />
        </div>
        <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-1/2 animate-loading-bar rounded-full bg-gradient-to-r from-[#6D4AFF] via-[#3A12DB] to-[#00A3FF]" />
        </div>
        <p className="mt-3 text-xs text-slate-400">
          This usually takes a few seconds on first load.
        </p>
      </div>
    </div>
  );
};
