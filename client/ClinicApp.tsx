import { Toaster } from "@/components/ui/toaster";
import { TranslationProvider } from "@/lib/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ClinicLayout } from "./components/layouts/ClinicLayout";
import ClinicLogin from "./pages/clinic/ClinicLogin";
import NotFound from "./pages/NotFound";

const ClinicDashboard = lazy(() => import("./pages/clinic/ClinicDashboard"));
const ClinicAppointments = lazy(() => import("./pages/clinic/ClinicAppointments"));
const ClinicInfo = lazy(() => import("./pages/clinic/ClinicInfo"));
const ClinicDoctors = lazy(() => import("./pages/clinic/ClinicDoctors"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

interface ClinicAppProps {
  basename?: string;
}

export default function ClinicApp({ basename }: ClinicAppProps) {
  return (
    <TranslationProvider defaultLanguage="ja" storageKey="dnm-clinic-language">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter basename={basename}>
          <Suspense
            fallback={
              <div className="flex h-screen items-center justify-center bg-gray-50 text-sm text-gray-500">
                Loading clinic portal...
              </div>
            }
          >
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
          </Suspense>
          <Toaster />
        </BrowserRouter>
      </QueryClientProvider>
    </TranslationProvider>
  );
}
