import { Link, useLocation } from "react-router-dom";
import { Home, Search, Calendar, User, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const location = useLocation();

  const navItems = [
    { path: "/", label: "Home", icon: Home },
    { path: "/search", label: "Search", icon: Search },
    { path: "/clinics", label: "Clinics", icon: Building2 },
    { path: "/appointment", label: "Appointment", icon: Calendar },
    { path: "/profile", label: "Profile", icon: User },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white shadow-[2px_0_20px_0_rgba(24,57,107,0.05)] z-50 border-t border-gray-100">
      <div className="max-w-md mx-auto px-3 sm:px-4 w-full">
        <nav className="flex justify-between items-start pt-1.5 pb-1.5">
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
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="h-[21px] flex items-center justify-center pb-safe">
          <div className="w-[134px] h-[5px] bg-[#091F44] rounded-full" />
        </div>
      </div>
    </div>
  );
}
