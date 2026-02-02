import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TranslationProvider } from "@/lib/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import AdminBookings from "./pages/AdminBookings";
import Appointment from "./pages/Appointment";
import Clinics from "./pages/Clinics";
import ClinicDetail from "./pages/ClinicDetail";
import DocDaisy from "./pages/DocDaisy";
import Index from "./pages/Index";
import MedicalRecords from "./pages/MedicalRecords";
import NotFound from "./pages/NotFound";
import PatientAuth from "./pages/PatientAuth";
import Profile from "./pages/Profile";
import Search from "./pages/Search";

const queryClient = new QueryClient();

declare global {
  interface Window {
    umami?: {
      track: (event?: string, data?: Record<string, unknown>) => void;
      trackView?: (url?: string, referrer?: string) => void;
    };
  }
}

const routes = [
  { path: "/", element: <Index /> },
  { path: "/home", element: <Index /> },
  { path: "/search", element: <Search /> },
  { path: "/clinics", element: <Clinics /> },
  { path: "/clinics/:clinicId", element: <ClinicDetail /> },
  { path: "/appointment", element: <Appointment /> },
  { path: "/medical-records", element: <MedicalRecords /> },
  { path: "/profile", element: <Profile /> },
  { path: "/docdaisy", element: <DocDaisy /> },
  { path: "/patient-auth", element: <PatientAuth /> },
  { path: "/admin/bookings", element: <AdminBookings /> },
] as const;

const TrackPageView = () => {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const url = `${location.pathname}${location.search}`;

    if (window.umami?.trackView) {
      window.umami.trackView(url);
      return;
    }

    window.umami?.track();
  }, [location.pathname, location.search]);

  return null;
};

export default function PatientApp() {
  return (
    <TranslationProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <TrackPageView />
            <Routes>
              {routes.map((route) => (
                <Route key={route.path} path={route.path} element={route.element} />
              ))}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </TranslationProvider>
  );
}
