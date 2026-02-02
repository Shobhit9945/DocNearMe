import { Link, useLocation } from "react-router-dom";
import { Home, Search, Calendar, User, Building2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

const navItems = [
  { path: "/home", label: "Home", icon: Home },
  { path: "/search", label: "Search", icon: Search },
  { path: "/clinics", label: "Clinics", icon: Building2 },
  { path: "/appointment", label: "Appointment", icon: Calendar },
  { path: "/profile", label: "Profile", icon: User },
];

export function DesktopNav() {
  const location = useLocation();
  const { t } = useTranslation();

  return (
    <div className="fixed left-0 top-0 z-30 hidden h-[100dvh] w-[260px] flex-col border-r border-slate-200 bg-white p-6 lg:flex overflow-y-auto">
      <div className="flex items-center gap-3 mb-8">
        <img src="/applogo.png" alt="DocNearMe" className="w-12 h-12 object-contain" />
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">{t("DocNearMe")}</p>
          <p className="text-lg font-semibold text-slate-900">{t("DocNearMe")}</p>
        </div>
      </div>
      <nav className="space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all",
                isActive
                  ? "bg-[#E5EEFF] text-[#1648CE] shadow-sm"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              )}
            >
              <Icon className="w-5 h-5" />
              {t(item.label)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
