import { BrowserRouter, Route, Routes } from "react-router-dom";
import AdminClinicOnboarding from "./pages/AdminClinicOnboarding";
import NotFound from "./pages/NotFound";

interface AdminAppProps {
  basename?: string;
}

export default function AdminApp({ basename }: AdminAppProps) {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/" element={<AdminClinicOnboarding />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
