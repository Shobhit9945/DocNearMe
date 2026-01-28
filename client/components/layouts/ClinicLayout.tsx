import React, { useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Calendar, UserSquare2, Users, LogOut } from "lucide-react";
import { clearClinicSession, getClinicSession } from "@/lib/clinic-auth";
import { useTranslation } from "@/lib/i18n";

export function ClinicLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { language, setLanguage, t } = useTranslation();
  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    const session = getClinicSession();
    if (!session) {
      navigate("/login");
    }
  }, [navigate]);

  const handleSignOut = () => {
    clearClinicSession();
    navigate("/login");
  };

  const toggleLanguage = () => {
    setLanguage(language === "ja" ? "en" : "ja");
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-blue-600">DocNearMe</h1>
          <p className="text-xs text-gray-500 font-medium tracking-wider uppercase mt-1">
            {t("Clinic Portal")}
          </p>
          <p className="text-xs text-gray-400 mt-2">{t("Clinic interface language")}</p>
          <button
            type="button"
            onClick={toggleLanguage}
            className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-blue-500 hover:text-blue-600"
          >
            {language === "ja" ? t("Switch to English") : t("Switch to Japanese")}
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <Link
            to="/"
            className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
              isActive("/")
                ? "bg-blue-50 text-blue-700"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <LayoutDashboard size={20} />
            {t("Dashboard")}
          </Link>
          <Link
            to="/appointments"
            className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
              isActive("/appointments")
                ? "bg-blue-50 text-blue-700"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Calendar size={20} />
            {t("Appointments")}
          </Link>
          <Link
            to="/clinic-info"
            className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
              isActive("/clinic-info")
                ? "bg-blue-50 text-blue-700"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <UserSquare2 size={20} />
            {t("Clinic info")}
          </Link>
          <Link
            to="/doctors"
            className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
              isActive("/doctors")
                ? "bg-blue-50 text-blue-700"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Users size={20} />
            {t("Doctors")}
          </Link>
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 w-full transition-colors"
          >
            <LogOut size={20} />
            {t("Sign out")}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-6xl p-6 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
