import "./global.css";

import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TranslationProvider } from "@/lib/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import AdminBookings from "./pages/AdminBookings";
import Appointment from "./pages/Appointment";
import Clinics from "./pages/Clinics";
import DocDaisy from "./pages/DocDaisy";
import Index from "./pages/Index";
import MedicalRecords from "./pages/MedicalRecords";
import NotFound from "./pages/NotFound";
import PatientAuth from "./pages/PatientAuth";
import Profile from "./pages/Profile";
import Search from "./pages/Search";

const queryClient = new QueryClient();

const routes = [
  { path: "/", element: <Index /> },
  { path: "/home", element: <Index /> },
  { path: "/search", element: <Search /> },
  { path: "/clinics", element: <Clinics /> },
  { path: "/appointment", element: <Appointment /> },
  { path: "/medical-records", element: <MedicalRecords /> },
  { path: "/profile", element: <Profile /> },
  { path: "/docdaisy", element: <DocDaisy /> },
  { path: "/patient-auth", element: <PatientAuth /> },
  { path: "/admin/bookings", element: <AdminBookings /> },
] as const;

const App = () => (
  <TranslationProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {routes.map((route) => (
              <Route key={route.path} path={route.path} element={route.element} />
            ))}
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </TranslationProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
