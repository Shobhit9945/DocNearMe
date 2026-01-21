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
    <div className="min-h-screen bg-[#FAFAFE]">
      <div className="w-full">
        <div className="lg:grid lg:grid-cols-[280px_1fr] min-h-screen">
          <div className="hidden lg:block">
            <DesktopNav />
          </div>
          <div
            className={cn(
              "relative flex flex-col bg-[#FAFAFE] min-h-screen lg:pr-8",
              contentClassName
            )}
          >
            <div className="absolute right-4 top-4 z-20">
              <LanguageSwitcher />
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
