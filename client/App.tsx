import "./global.css";
import { createRoot } from "react-dom/client";
import PatientApp from "./PatientApp";
import ClinicApp from "./ClinicApp";

// Function to check subdomain
const getApp = () => {
  const hostname = window.location.hostname;
  // const params = new URLSearchParams(window.location.search);
  
  // PRODUCTION: This will only start the clinic app if the ACTUAL URL starts with 'clinic.'
  // Example: clinic.docnearme.jp
  if (hostname.startsWith('clinic.')) {
     return <ClinicApp />;
  }
  
  return <PatientApp />;
};

createRoot(document.getElementById("root")!).render(getApp());
