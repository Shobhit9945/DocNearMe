import { Toaster } from "@/components/ui/toaster";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ClinicLayout } from "./components/layouts/ClinicLayout";
import ClinicDashboard from "./pages/clinic/ClinicDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

export default function ClinicApp() {
  return (
    <QueryClientProvider client={queryClient}>
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<ClinicLayout />}>
                    <Route index element={<ClinicDashboard />} />
                    <Route path="appointments" element={<div>Appointments Page</div>} />
                    <Route path="settings" element={<div>Settings Page</div>} />
                    <Route path="*" element={<NotFound />} />
                </Route>
            </Routes>
            <Toaster />
        </BrowserRouter>
    </QueryClientProvider>
  );
}
