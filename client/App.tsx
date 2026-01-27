import "./global.css";
import { createRoot } from "react-dom/client";
import PatientApp from "./PatientApp";
import ClinicApp from "./ClinicApp";

// Function to check subdomain
const getApp = () => {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;
  
  // PRODUCTION: This will only start the clinic app if the ACTUAL URL starts with 'clinic.'
  // Example: clinic.docnearme.jp
  if (hostname.startsWith('clinic.')) {
     return <ClinicApp />;
  }

  // Netlify does not support arbitrary subdomains on *.netlify.app,
  // so allow the clinic app to mount under /clinic for temporary use.
  if (hostname.endsWith(".netlify.app") && pathname.startsWith("/clinic")) {
     return <ClinicApp basename="/clinic" />;
  }
  
  return <PatientApp />;
};

createRoot(document.getElementById("root")!).render(getApp());
