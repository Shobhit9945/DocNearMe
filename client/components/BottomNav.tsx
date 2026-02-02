import { Link, useLocation } from "react-router-dom";
import { Home, Search, Calendar, User, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

export function BottomNav() {
  const location = useLocation();
  const { t } = useTranslation();

  const navItems = [
    { path: "/home", label: "Home", icon: Home },
    { path: "/search", label: "Search", icon: Search },
    { path: "/clinics", label: "Clinics", icon: Building2 },
    { path: "/appointment", label: "Appointment", icon: Calendar },
    { path: "/profile", label: "Profile", icon: User },
  ];

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-100 bg-white/95 shadow-[2px_0_20px_0_rgba(24,57,107,0.05)] backdrop-blur">
      <div className="mx-auto w-full max-w-md px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-2 sm:px-4">
        <nav className="flex items-start justify-between gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex flex-col items-center gap-0.5 flex-1 max-w-[64px] transition-all"
              >
                <div className={cn(
                  "w-8 h-8 rounded-[10px] flex items-center justify-center transition-colors",
                  isActive ? "bg-[#F5FAFF]" : "hover:bg-gray-50"
                )}>
                  <Icon
                    className={cn(
                      "w-5 h-5 transition-colors",
                      isActive ? "text-[#1648CE]" : "text-[#929CAD]"
                    )}
                  />
                </div>
                <span className={cn(
                  "text-[10px] font-normal transition-colors",
                  isActive ? "text-[#1648CE] font-medium" : "text-[#929CAD]"
                )}>
                  {t(item.label)}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
