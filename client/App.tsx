import "./global.css";
import { createRoot } from "react-dom/client";
import PatientApp from "./PatientApp";
import ClinicApp from "./ClinicApp";
import AdminApp from "./AdminApp";

// Function to check subdomain
const getApp = () => {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;
  
  // PRODUCTION: This will only start the clinic app if the ACTUAL URL starts with 'clinic.'
  // Example: clinic.docnearme.jp
  if (hostname.startsWith('clinic.')) {
     return <ClinicApp />;
  }

  if (hostname.startsWith("admin.")) {
    return <AdminApp />;
  }

  // Netlify does not support arbitrary subdomains on *.netlify.app,
  // so allow the clinic app to mount under /clinic for temporary use.
  if (hostname.endsWith(".netlify.app") && pathname.startsWith("/clinic")) {
     return <ClinicApp basename="/clinic" />;
  }

  if (hostname.endsWith(".netlify.app") && pathname.startsWith("/admin")) {
    return <AdminApp basename="/admin" />;
  }
  
  return <PatientApp />;
};

createRoot(document.getElementById("root")!).render(getApp());
