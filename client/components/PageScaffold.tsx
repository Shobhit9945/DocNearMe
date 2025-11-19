import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DesktopNav } from "./DesktopNav";

interface PageScaffoldProps {
  children: ReactNode;
  contentClassName?: string;
}

export function PageScaffold({ children, contentClassName }: PageScaffoldProps) {
  return (
    <div className="min-h-screen bg-[#EAF1FF]">
      <div className="mx-auto w-full lg:max-w-6xl lg:px-6 lg:py-10">
        <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-8">
          <DesktopNav />
          <div
            className={cn(
              "relative flex flex-col bg-[#FAFAFE] min-h-screen lg:min-h-[80vh] lg:rounded-3xl lg:shadow-2xl",
              contentClassName
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
