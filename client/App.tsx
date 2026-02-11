import "./global.css";
import { Suspense, lazy, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { LoadingScreen } from "./components/LoadingScreen";

const PatientApp = lazy(() => import("./PatientApp"));
const ClinicApp = lazy(() => import("./ClinicApp"));
const AdminApp = lazy(() => import("./AdminApp"));

const APP_ROOT = "docnearme.app";
const JP_ROOT = "docnearme.jp";

const buildRedirectTarget = (hostname: string) => {
  if (hostname === APP_ROOT) {
    return JP_ROOT;
  }
  if (hostname === `www.${APP_ROOT}`) {
    return `www.${JP_ROOT}`;
  }
  if (hostname.endsWith(`.${APP_ROOT}`)) {
    return hostname.replace(`.${APP_ROOT}`, `.${JP_ROOT}`);
  }
  return null;
};

const RedirectNotice = ({ targetUrl }: { targetUrl: string }) => {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.location.replace(targetUrl);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [targetUrl]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl p-6 space-y-4">
        <div className="text-lg font-semibold">We have moved to .jp</div>
        <p className="text-sm text-slate-300">
          Redirecting you to the new address. If nothing happens, use the link below.
        </p>
        <input
          className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
          value={targetUrl}
          readOnly
          aria-label="New website URL"
        />
        <a
          className="inline-flex items-center text-sm font-medium text-sky-300 hover:text-sky-200"
          href={targetUrl}
        >
          Go to docnearme.jp now
        </a>
      </div>
    </div>
  );
};

// Function to check subdomain
const getApp = () => {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;
  const redirectHost = buildRedirectTarget(hostname);
  if (redirectHost) {
    const targetUrl = `${window.location.protocol}//${redirectHost}${window.location.pathname}${window.location.search}${window.location.hash}`;
    return <RedirectNotice targetUrl={targetUrl} />;
  }
  
  // PRODUCTION: Start the clinic app for clinic subdomains (e.g., clinic.*, www.clinic.*)
  if (
    hostname.startsWith("clinic.") ||
    hostname.startsWith("www.clinic.") ||
    hostname.endsWith(".clinic.docnearme.app") ||
    hostname.includes(".clinic.")
  ) {
    return (
      <Suspense
        fallback={
          <LoadingScreen
            title="Loading clinic portal"
            subtitle="Preparing your clinic dashboard."
          />
        }
      >
        <ClinicApp />
      </Suspense>
    );
  }

  if (hostname.startsWith("admin.") || hostname.startsWith("www.admin.")) {
    return (
      <Suspense
        fallback={
          <LoadingScreen
            title="Loading admin console"
            subtitle="Loading tools and analytics."
          />
        }
      >
        <AdminApp />
      </Suspense>
    );
  }

  // Netlify does not support arbitrary subdomains on *.netlify.app,
  // so allow the clinic app to mount under /clinic for temporary use.
  if (hostname.endsWith(".netlify.app") && pathname.startsWith("/clinic")) {
    return (
      <Suspense
        fallback={
          <LoadingScreen
            title="Loading clinic portal"
            subtitle="Preparing your clinic dashboard."
          />
        }
      >
        <ClinicApp basename="/clinic" />
      </Suspense>
    );
  }

  if (hostname.endsWith(".netlify.app") && pathname.startsWith("/admin")) {
    return (
      <Suspense
        fallback={
          <LoadingScreen
            title="Loading admin console"
            subtitle="Loading tools and analytics."
          />
        }
      >
        <AdminApp basename="/admin" />
      </Suspense>
    );
  }

  return (
    <Suspense
      fallback={
        <LoadingScreen
          title="Loading DocNearMe"
          subtitle="Preparing the patient experience."
        />
      }
    >
      <PatientApp />
    </Suspense>
  );
};

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  });
}

createRoot(document.getElementById("root")!).render(getApp());
