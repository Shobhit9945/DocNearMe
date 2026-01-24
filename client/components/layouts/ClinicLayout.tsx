import React, { useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Calendar, UserSquare2, Users, LogOut } from "lucide-react";
import { clearClinicSession, getClinicSession } from "@/lib/clinic-auth";

export function ClinicLayout() {
  const location = useLocation();
  const navigate = useNavigate();
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

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-blue-600">DocNearMe</h1>
          <p className="text-xs text-gray-500 font-medium tracking-wider uppercase mt-1">
            Clinic Portal
          </p>
          <p className="text-xs text-gray-400 mt-2">English (preview)</p>
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
            Dashboard
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
            Appointments
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
            Clinic info
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
            Doctors
          </Link>
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 w-full transition-colors"
          >
            <LogOut size={20} />
            Sign out
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
