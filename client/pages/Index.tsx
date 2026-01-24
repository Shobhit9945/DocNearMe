import React, { useEffect, useMemo, useState } from "react";
import { Activity, Ambulance, ClipboardList, Navigation } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { DocDaisyBanner } from "@/components/DocDaisyBanner";
import { PageScaffold } from "@/components/PageScaffold";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLiveLocation } from "@/hooks/useLiveLocation";
import { useAddressSearch } from "@/hooks/useAddressSearch";
import { useTranslation } from "@/lib/i18n";
import { getKeyStorageKey, storeLocalVaultKey, unwrapVaultKey } from "@/lib/medicalVault";
import type { MedicalRecordKeyResponse } from "@shared/api";

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

const TOKEN_KEY = "docnearme_patient_token";
const EMAIL_KEY = "docnearme_user_email";

const Index: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentLocation,
    locationError,
    isFetchingLocation,
    manualLocation,
    setManualLocation,
    clearManualLocation,
  } = useLiveLocation();
  const { t } = useTranslation();
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [manualLocationInput, setManualLocationInput] = useState(manualLocation ?? "");
  const [manualLocationError, setManualLocationError] = useState("");
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [showVaultUnlock, setShowVaultUnlock] = useState(false);
  const [vaultPassword, setVaultPassword] = useState("");
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [vaultKeyPayload, setVaultKeyPayload] = useState<MedicalRecordKeyResponse | null>(null);
  const [isCheckingVault, setIsCheckingVault] = useState(false);
  const [isUnlockingVault, setIsUnlockingVault] = useState(false);
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const {
    suggestions,
    isLoading: isSuggesting,
    error: suggestionError,
    fetchPlaceDetails,
    geocodeAddress,
  } = useAddressSearch(manualLocationInput);

  const locationStatus = useMemo(() => {
    if (manualLocation) return "Manual address";
    if (isFetchingLocation) return "Fetching your location...";
    if (locationError) return locationError;
    return "Updated a moment ago";
  }, [isFetchingLocation, locationError, manualLocation]);

  const locationLabel = useMemo(
    () => (isFetchingLocation ? t("Fetching real-time location...") : currentLocation),
    [currentLocation, isFetchingLocation, t]
  );

  useEffect(() => {
    setManualLocationInput(manualLocation ?? "");
  }, [manualLocation]);

  useEffect(() => {
    const hasSeenPrompt = window.localStorage.getItem("dnm_login_prompted");
    if (!hasSeenPrompt) {
      setShowLoginPrompt(true);
      window.localStorage.setItem("dnm_login_prompted", "true");
    }
  }, []);

  const handleMedicalRecordsClick = async () => {
    if (isCheckingVault) return;
    const token = localStorage.getItem(TOKEN_KEY)?.trim();
    const email = localStorage.getItem(EMAIL_KEY) ?? undefined;
    if (!token) {
      navigate("/medical-records");
      return;
    }

    const hasLocalKey = Boolean(localStorage.getItem(getKeyStorageKey(email)));
    if (hasLocalKey) {
      navigate("/medical-records");
      return;
    }

    setIsCheckingVault(true);
    setVaultError(null);
    try {
      const response = await fetch("/api/medical-records/key", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json()) as MedicalRecordKeyResponse;
      if (response.ok && data.hasKey && data.key) {
        setVaultKeyPayload(data);
        setShowVaultUnlock(true);
        return;
      }
      navigate("/medical-records");
    } catch {
      navigate("/medical-records");
    } finally {
      setIsCheckingVault(false);
    }
  };

  const handleVaultUnlock = async () => {
    const token = localStorage.getItem(TOKEN_KEY)?.trim();
    const email = localStorage.getItem(EMAIL_KEY) ?? undefined;
    if (!token || !vaultKeyPayload?.key) {
      setShowVaultUnlock(false);
      return;
    }
    if (!vaultPassword.trim()) {
      setVaultError(t("Please enter your account password to unlock the vault."));
      return;
    }
    setVaultError(null);
    setIsUnlockingVault(true);
    try {
      const key = await unwrapVaultKey(vaultKeyPayload.key, vaultPassword);
      await storeLocalVaultKey(email, key);
      setVaultPassword("");
      setShowVaultUnlock(false);
      navigate("/medical-records");
    } catch (error) {
      setVaultError(t("Unable to unlock the vault. Please check your password."));
    } finally {
      setIsUnlockingVault(false);
    }
  };

  useEffect(() => {
    if (!carouselApi) return;

    const interval = window.setInterval(() => {
      if (carouselApi.canScrollNext()) {
        carouselApi.scrollNext();
      } else {
        carouselApi.scrollTo(0);
      }
    }, 5000);

    return () => window.clearInterval(interval);
  }, [carouselApi]);

  const handleManualLocationSave = async () => {
    const trimmed = manualLocationInput.trim();
    if (!trimmed) return;
    setIsResolvingAddress(true);
    setManualLocationError("");

    try {
      const resolvedAddress = await geocodeAddress(trimmed);
      setManualLocation(resolvedAddress);
      setManualLocationInput(resolvedAddress);
      setIsEditingLocation(false);
      setShowSuggestions(false);
    } catch (error) {
      setManualLocationError(
        error instanceof Error ? error.message : "Unable to verify this address. Try again.",
      );
    } finally {
      setIsResolvingAddress(false);
    }
  };

  const handleSuggestionSelect = async (placeId: string) => {
    setIsResolvingAddress(true);
    setManualLocationError("");
    try {
      const resolvedAddress = await fetchPlaceDetails(placeId);
      setManualLocation(resolvedAddress);
      setManualLocationInput(resolvedAddress);
      setIsEditingLocation(false);
      setShowSuggestions(false);
    } catch (error) {
      setManualLocationError(
        error instanceof Error ? error.message : "Unable to verify this address. Try again.",
      );
    } finally {
      setIsResolvingAddress(false);
    }
  };

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
      onClick: () => void handleMedicalRecordsClick(),
      textClassName: "text-sm font-medium text-center",
    },
    {
      label: "Emergency SOS",
      className:
        "bg-[#FB4F4F] rounded-[20px] shadow-[2px_0_20px_0_rgba(24,57,107,0.05)] p-4 min-h-[120px] flex flex-col items-center justify-center gap-2 text-white hover:bg-[#E94444] transition-colors",
      icon: <Ambulance className="w-[42px] h-[30px]" />,
      onClick: () => {
        window.location.href = "tel:119";
      },
      textClassName: "text-sm font-medium text-center",
    },
  ] as const;

  const heroSlides = [
    {
      title: t("APPOINTMENT BOOKING NOW AT YOUR FINGERTIPS"),
      headline: t("WITH DOCNEARME"),
      description: t("Plan, book and manage visits in seconds."),
      cta: t("Learn more"),
      image:
        "https://api.builder.io/api/v1/image/assets/TEMP/94dd9abcae8bb5e056848f9449decbaac63a2b5f?width=312",
      accent: "from-[#FAFAFE] to-[#E1F6FF]",
    },
    {
      title: t("YOUR HEALTH, YOUR SCHEDULE"),
      headline: t("FAST CLINIC MATCHING"),
      description: t("Find nearby clinics and specialists instantly."),
      cta: t("Find clinics"),
      image:
        "https://api.builder.io/api/v1/image/assets/TEMP/efd1a0a0a615de8dfe2ff92c5e5efa34e4764d7a?width=584",
      accent: "from-[#F4FAFF] to-[#DDF1FF]",
    },
    {
      title: t("CARE THAT MOVES WITH YOU"),
      headline: t("DOCDAISY SUPPORT"),
      description: t("Ask questions and get guidance in real time."),
      cta: t("Ask DocDaisy"),
      image: "/applogo.png",
      accent: "from-[#F9F7FF] to-[#E8E7FF]",
    },
  ];

  return (
    <PageScaffold contentClassName="pb-28 lg:pb-12">
      <header className="bg-white px-4 pt-10 pb-4 border-b border-gray-100 shadow-sm lg:px-10 lg:rounded-t-3xl lg:border-none lg:shadow-none">
        <div className="mx-auto w-full max-w-6xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-[#EBF5FF] p-2">
              <Navigation className="w-7 h-7 text-[#0089FF]" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t("Live location")}</p>
              <p className={`text-base font-bold leading-snug ${locationError ? "text-red-500" : "text-slate-900"}`}>
                {locationLabel}
              </p>
              <p className={`text-xs mt-1 ${locationError ? "text-red-500" : "text-slate-500"}`}>
                {t(locationStatus)}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {manualLocation && (
                  <span className="rounded-full bg-[#E8F3FF] px-2.5 py-1 text-[11px] font-semibold text-[#1648CE]">
                    {t("Manual address")}
                  </span>
                )}
                <button
                  type="button"
                  className="text-xs font-semibold text-[#0089FF] hover:text-[#0077E6]"
                  onClick={() => setIsEditingLocation(true)}
                >
                  {manualLocation ? t("Edit address") : t("Enter address manually")}
                </button>
                {manualLocation && (
                  <button
                    type="button"
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                    onClick={() => {
                      clearManualLocation();
                      setIsEditingLocation(false);
                    }}
                  >
                    {t("Use GPS instead")}
                  </button>
                )}
              </div>
              {isEditingLocation && (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={manualLocationInput}
                    onChange={(event) => setManualLocationInput(event.target.value)}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder={t("Type your address")}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-[#0089FF] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleManualLocationSave}
                    disabled={isResolvingAddress}
                    className="rounded-xl bg-[#002D55] px-4 py-2 text-xs font-semibold text-white hover:bg-[#003366] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isResolvingAddress ? t("Searching...") : t("Save")}
                  </button>
                </div>
              )}
              {isEditingLocation && showSuggestions && (
                <div className="mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-lg">
                  {isSuggesting && (
                    <p className="px-3 py-2 text-xs text-slate-500">{t("Searching address results...")}</p>
                  )}
                  {!isSuggesting && suggestionError && (
                    <p className="px-3 py-2 text-xs text-red-500">{suggestionError}</p>
                  )}
                  {!isSuggesting && !suggestionError && suggestions.length === 0 && manualLocationInput.trim() && (
                    <p className="px-3 py-2 text-xs text-slate-500">{t("No matching addresses yet.")}</p>
                  )}
                  {!isSuggesting && suggestions.length > 0 && (
                    <ul className="max-h-52 overflow-y-auto py-1 text-sm text-slate-700">
                      {suggestions.map((suggestion) => (
                        <li key={suggestion.placeId}>
                          <button
                            type="button"
                            onClick={() => handleSuggestionSelect(suggestion.placeId)}
                            className="w-full px-3 py-2 text-left hover:bg-[#F1F5FF]"
                          >
                            {suggestion.description}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {manualLocationError && (
                <p className="mt-2 text-xs text-red-500">{manualLocationError}</p>
              )}
            </div>
          </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pt-4 lg:px-10 lg:pt-8">
        <div className="mx-auto w-full max-w-6xl lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-8">
          <section className="space-y-5">
            <Carousel
              setApi={setCarouselApi}
              opts={{ loop: true }}
              className="relative"
            >
              <CarouselContent>
                {heroSlides.map((slide) => (
                  <CarouselItem key={slide.headline}>
                    <div
                      className={`relative flex h-[180px] flex-col justify-between overflow-hidden rounded-[20px] border border-[#D4EBFF] bg-gradient-to-br ${slide.accent} p-4 shadow-[0_1px_14px_0_#DFE8EC] sm:h-[200px] sm:p-5 lg:h-[240px] lg:p-8`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-xs font-bold text-[#002D55] sm:text-sm">
                            {slide.title}
                          </p>
                          <h1 className="text-lg font-extrabold text-[#002D55] mt-2 sm:text-2xl">
                            {slide.headline}
                          </h1>
                          <p className="mt-2 text-xs text-slate-500 sm:text-sm">
                            {slide.description}
                          </p>
                        </div>
                        <img
                          src={slide.image}
                          alt={slide.headline}
                          className="h-20 w-20 flex-shrink-0 object-contain sm:h-24 sm:w-24 lg:h-32 lg:w-32"
                        />
                      </div>
                      <div className="mt-3 flex">
                        <button className="bg-[#002D55] text-white text-xs font-semibold px-4 py-2 rounded-[12px] shadow-[0_3px_16px_0_rgba(15,39,74,0.10)] hover:bg-[#003366] transition-colors sm:text-sm">
                          {slide.cta}
                        </button>
                      </div>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {quickActions.map((action) => {
                const isMedicalRecords = action.label === "Medical Records";
                const isDisabled = isMedicalRecords && isCheckingVault;
                return (
                  <button
                    key={action.label}
                    className={`${action.className} ${isDisabled ? "cursor-not-allowed opacity-70" : ""}`}
                    onClick={action.onClick}
                    disabled={isDisabled}
                  >
                    {action.icon}
                    <span className={action.textClassName}>{t(action.label)}</span>
                  </button>
                );
              })}
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

      <Dialog
        open={showLoginPrompt}
        onOpenChange={(open) => setShowLoginPrompt(open)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("Welcome to DocNearMe")}</DialogTitle>
            <DialogDescription>
              {t("Sign in to manage appointments, access records, and get updates.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setShowLoginPrompt(false)}
            >
              {t("Maybe later")}
            </Button>
            <Button
              onClick={() => {
                setShowLoginPrompt(false);
                navigate("/patient-auth");
              }}
            >
              {t("Login")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showVaultUnlock}
        onOpenChange={(open) => {
          setShowVaultUnlock(open);
          if (!open) {
            setVaultPassword("");
            setVaultError(null);
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("Unlock your vault")}</DialogTitle>
            <DialogDescription>
              {t("Enter your account password to access encrypted medical records on this device.")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="password"
              placeholder={t("Enter your account password")}
              value={vaultPassword}
              onChange={(event) => setVaultPassword(event.target.value)}
            />
            {vaultError && <p className="text-xs text-red-500">{vaultError}</p>}
          </div>
          <DialogFooter className="mt-4 flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowVaultUnlock(false)}
              disabled={isUnlockingVault}
            >
              {t("Cancel")}
            </Button>
            <Button type="button" onClick={() => void handleVaultUnlock()} disabled={isUnlockingVault}>
              {isUnlockingVault ? t("Unlocking...") : t("Unlock and continue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageScaffold>
  );
};

export default Index;
