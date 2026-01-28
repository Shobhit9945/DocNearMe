import { Toaster } from "@/components/ui/toaster";
import { TranslationProvider } from "@/lib/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ClinicLayout } from "./components/layouts/ClinicLayout";
import ClinicDashboard from "./pages/clinic/ClinicDashboard";
import ClinicAppointments from "./pages/clinic/ClinicAppointments";
import ClinicInfo from "./pages/clinic/ClinicInfo";
import ClinicDoctors from "./pages/clinic/ClinicDoctors";
import ClinicLogin from "./pages/clinic/ClinicLogin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

interface ClinicAppProps {
  basename?: string;
}

export default function ClinicApp({ basename }: ClinicAppProps) {
  return (
    <TranslationProvider defaultLanguage="ja" storageKey="dnm-clinic-language">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter basename={basename}>
          <Routes>
            <Route path="/login" element={<ClinicLogin />} />
            <Route path="/" element={<ClinicLayout />}>
              <Route index element={<ClinicDashboard />} />
              <Route path="appointments" element={<ClinicAppointments />} />
              <Route path="clinic-info" element={<ClinicInfo />} />
              <Route path="doctors" element={<ClinicDoctors />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
          <Toaster />
        </BrowserRouter>
      </QueryClientProvider>
    </TranslationProvider>
  );
}
