import React, { useMemo } from "react";
import { Activity, Ambulance, ClipboardList, Navigation } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { DocDaisyBanner } from "@/components/DocDaisyBanner";
import { PageScaffold } from "@/components/PageScaffold";
import { useLiveLocation } from "@/hooks/useLiveLocation";
import { useTranslation } from "@/lib/i18n";

const VIEW_APPOINTMENTS_ICON = (
  <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none">
    <path
      d="M4 9.33333V6.66667C4 5.95942 4.28095 5.28115 4.78105 4.78105C5.28115 4.28095 5.95942 4 6.66667 4H9.33333"
      stroke="white"
      strokeWidth="2.66667"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M22.6667 4H25.3334C26.0406 4 26.7189 4.28095 27.219 4.78105C27.7191 5.28115 28 5.95942 28 6.66667V9.33333"
      stroke="white"
      strokeWidth="2.66667"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M28 22.6667V25.3333C28 26.0406 27.7191 26.7188 27.219 27.2189C26.7189 27.719 26.0406 28 25.3334 28H22.6667"
      stroke="white"
      strokeWidth="2.66667"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9.33333 28H6.66667C5.95942 28 5.28115 27.719 4.78105 27.2189C4.28095 26.7188 4 26.0406 4 25.3333V22.6667"
      stroke="white"
      strokeWidth="2.66667"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16 20C18.2091 20 20 18.2091 20 16C20 13.7909 18.2091 12 16 12C13.7909 12 12 13.7909 12 16C12 18.2091 13.7909 20 16 20Z"
      stroke="white"
      strokeWidth="2.66667"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M21.3333 21.3334L18.7999 18.8"
      stroke="white"
      strokeWidth="2.66667"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

type QuickAction = {
  label: string;
  className: string;
  icon: React.ReactNode;
  textClassName: string;
  onClick?: () => void;
};

const Index: React.FC = () => {
  const navigate = useNavigate();
  const { currentLocation, locationError, isFetchingLocation } = useLiveLocation();
  const { t } = useTranslation();

  const locationStatus = useMemo(() => {
    if (isFetchingLocation) return "Fetching your location...";
    if (locationError) return locationError;
    return "Updated a moment ago";
  }, [isFetchingLocation, locationError]);

  const quickActions: QuickAction[] = [
    {
      label: "Book Appointment",
      className:
        "bg-[#0089FF] rounded-[20px] shadow-[2px_0_20px_0_rgba(24,57,107,0.05)] p-4 min-h-[120px] flex flex-col items-center justify-center gap-2 text-white hover:bg-[#0077E6] transition-colors",
      icon: <ClipboardList className="w-8 h-8" />,
      onClick: () => navigate("/appointment?view=booking"),
      textClassName: "text-sm font-medium text-center",
    },
    {
      label: "View Appointments",
      className:
        "bg-[#0089FF] rounded-[20px] shadow-[2px_0_20px_0_rgba(24,57,107,0.05)] p-4 min-h-[120px] flex flex-col items-center justify-center gap-2 text-white/90 hover:bg-[#0077E6] transition-colors",
      icon: VIEW_APPOINTMENTS_ICON,
      onClick: () => navigate("/appointment?view=upcoming"),
      textClassName: "text-sm font-medium text-center",
    },
    {
      label: "Medical Records",
      className:
        "bg-[#0089FF] rounded-[20px] shadow-[2px_0_20px_0_rgba(24,57,107,0.05)] p-4 min-h-[120px] flex flex-col items-center justify-center gap-2 text-white/90 hover:bg-[#0077E6] transition-colors",
      icon: <Activity className="w-8 h-8" />,
      onClick: () => navigate("/medical-records"),
      textClassName: "text-sm font-medium text-center",
    },
    {
      label: "Emergency SOS",
      className:
        "bg-[#FB4F4F] rounded-[20px] shadow-[2px_0_20px_0_rgba(24,57,107,0.05)] p-4 min-h-[120px] flex flex-col items-center justify-center gap-2 text-white hover:bg-[#E94444] transition-colors",
      icon: <Ambulance className="w-[42px] h-[30px]" />,
      textClassName: "text-sm font-medium text-center",
    },
  ] as const;

  return (
    <PageScaffold contentClassName="pb-28 lg:pb-12">
      <header className="bg-white px-4 pt-10 pb-4 border-b border-gray-100 shadow-sm lg:px-10 lg:rounded-t-3xl lg:border-none lg:shadow-none">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-[#EBF5FF] p-2">
              <Navigation className="w-7 h-7 text-[#0089FF]" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t("Live location")}</p>
              <p className={`text-base font-bold leading-snug ${locationError ? "text-red-500" : "text-slate-900"}`}>
                {currentLocation}
              </p>
              <p className={`text-xs mt-1 ${locationError ? "text-red-500" : "text-slate-500"}`}>
                {t(locationStatus)}
              </p>
            </div>
          </div>
          <img src="/dnm.png" alt="DocNearMe Logo" className="w-14 h-14 object-contain self-start" />
        </div>
      </header>

      <main className="flex-1 px-4 pt-4 lg:px-10 lg:pt-8">
        <div className="lg:grid lg:grid-cols-[2fr_1fr] lg:gap-8">
          <section className="space-y-5">
            <div className="relative overflow-hidden rounded-[20px] border border-[#D4EBFF] bg-gradient-to-br from-[#FAFAFE] to-[#E1F6FF] p-5 shadow-[0_1px_14px_0_#DFE8EC] lg:p-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <div className="flex-1 z-10">
                  <p className="text-sm font-bold text-[#002D55]">
                    {t("APPOINTMENT BOOKING NOW AT YOUR FINGERTIPS")}
                  </p>
                  <h1 className="text-2xl font-extrabold text-[#002D55] mt-2 mb-4">{t("WITH DOCNEARME")}</h1>
                  <div className="flex flex-wrap items-center gap-3">
                    <button className="bg-[#002D55] text-white text-sm font-semibold px-6 py-3 rounded-[12px] shadow-[0_3px_16px_0_rgba(15,39,74,0.10)] hover:bg-[#003366] transition-colors">
                      {t("Learn more")}
                    </button>
                    <button
                      className="bg-white text-[#002D55] text-sm font-semibold px-6 py-3 rounded-[12px] border border-[#002D55] hover:bg-[#F0F6FF] transition-colors"
                      onClick={() => navigate("/patient-auth")}
                    >
                      {t("Patient Login")}
                    </button>
                    <p className="text-xs text-slate-500">{t("Plan, book and manage visits in seconds.")}</p>
                  </div>
                </div>
                <img
                  src="https://api.builder.io/api/v1/image/assets/TEMP/94dd9abcae8bb5e056848f9449decbaac63a2b5f?width=312"
                  alt="Doctors illustration"
                  className="w-full max-w-[220px] object-contain"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  className={action.className}
                  onClick={action.onClick}
                >
                  {action.icon}
                  <span className={action.textClassName}>{t(action.label)}</span>
                </button>
              ))}
            </div>

            <div className="rounded-[20px] bg-gradient-to-b from-[#FAFAFE] to-[#D4F5FF] px-4 py-6 text-center lg:px-10">
              <h3 className="text-base font-bold text-black">{t("SAVE TIME BY AVOIDING LONG QUEUES")}</h3>
              <p className="text-sm text-black mt-2">{t("BOOK YOUR APPOINTMENT WITH THE DOCTOR YOU NEED")}</p>
              <div className="mt-4 flex justify-center">
                <img
                  src="https://api.builder.io/api/v1/image/assets/TEMP/efd1a0a0a615de8dfe2ff92c5e5efa34e4764d7a?width=584"
                  alt="Hospital queue illustration"
                  className="w-full max-w-[360px] rounded-xl object-cover"
                />
              </div>
            </div>
          </section>

          <aside className="hidden lg:flex flex-col gap-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Current location</p>
              <p className="text-base font-bold text-slate-900 leading-snug">{currentLocation}</p>
              {locationError ? (
                <p className="text-sm text-red-500 mt-2">{locationError}</p>
              ) : (
                <p className="text-sm text-slate-500 mt-2">
                  Your nearest clinics are shown based on this location.
                </p>
              )}
            </div>
            <DocDaisyBanner variant="card" onClick={() => navigate("/docdaisy")} className="bg-white" />
          </aside>
        </div>
      </main>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="fixed bottom-24 right-4 left-4 z-50 lg:hidden"
      >
        <DocDaisyBanner onClick={() => navigate("/docdaisy")} />
      </motion.div>

      <div className="lg:hidden">
        <BottomNav />
      </div>
    </PageScaffold>
  );
};

export default Index;
