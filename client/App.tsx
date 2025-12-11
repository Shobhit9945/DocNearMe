import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TranslationProvider } from "@/lib/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Search from "./pages/Search";
import Appointment from "./pages/Appointment";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import DocDaisy from "./pages/DocDaisy";
import Clinics from "./pages/Clinics";
import AuthPage from "./pages/Auth";
import AdminBookings from "./pages/AdminBookings";
import { AuthProvider } from "./lib/auth-context";
//import BookAppointment from "./pages/BookAppointment";

const queryClient = new QueryClient();

const App = () => (
  <TranslationProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/search" element={<Search />} />
              <Route path="/clinics" element={<Clinics />} />
              <Route path="/appointment" element={<Appointment />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/docdaisy" element={<DocDaisy />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/admin/bookings" element={<AdminBookings />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </TranslationProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
