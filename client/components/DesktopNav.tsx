import { Link, useLocation } from "react-router-dom";
import { Home, Search, Calendar, User, MessageSquare, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

const navItems = [
  { path: "/", label: "Home", icon: Home },
  { path: "/search", label: "Search", icon: Search },
  { path: "/clinics", label: "Clinics", icon: Building2 },
  { path: "/appointment", label: "Appointment", icon: Calendar },
  { path: "/profile", label: "Profile", icon: User },
];

export function DesktopNav() {
  const location = useLocation();
  const { t } = useTranslation();

  return (
    <div className="sticky top-10 hidden lg:flex">
      <div className="w-full max-w-xs rounded-3xl bg-white/90 p-6 shadow-2xl ring-1 ring-black/5">
        <div className="flex items-center gap-3 mb-8">
          <img src="/dnm.png" alt="DocNearMe" className="w-12 h-12 object-contain" />
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">{t("DocNearMe")}</p>
            <p className="text-lg font-semibold text-slate-900">{t("Care Hub")}</p>
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
        <div className="mt-8 rounded-2xl bg-gradient-to-br from-[#1648CE] to-[#0089FF] p-4 text-white">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-6 h-6" />
            <div>
              <p className="text-xs text-white/80">{t("Need help?")}</p>
              <p className="text-base font-semibold">{t("DocDaisy is online")}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
