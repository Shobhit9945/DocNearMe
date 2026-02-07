import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DesktopNav } from "./DesktopNav";
import { LanguageSwitcher } from "./LanguageSwitcher";

interface PageScaffoldProps {
  children: ReactNode;
  contentClassName?: string;
}

export function PageScaffold({ children, contentClassName }: PageScaffoldProps) {
  return (
    <div className="min-h-[100dvh] bg-[#FAFAFE]">
      <div className="w-full">
        <DesktopNav />
        <div
          className={cn(
            "relative flex flex-col bg-[#FAFAFE] min-h-[100dvh] w-full lg:pl-[260px]",
            contentClassName
          )}
        >
          <div className="absolute right-4 top-4 z-20 lg:right-6 lg:top-5">
            <LanguageSwitcher />
          </div>
          {children}
          <footer className="mt-auto border-t border-slate-200 bg-white px-6 py-6 text-xs text-slate-500">
            <p>
              By continuing past this page, you agree to our Terms of Service, Cookie Policy, Privacy Policy and
              Content Policies. All trademarks are properties of their respective owners.
            </p>
            <p className="mt-2">2025-2026 © DocNearMe™ Ltd. All rights reserved.</p>
          </footer>
        </div>
      </div>
    </div>
  );
}
