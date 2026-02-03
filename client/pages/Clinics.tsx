import { useEffect, useMemo, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { DocDaisyBanner } from "@/components/DocDaisyBanner";
import { PageScaffold } from "@/components/PageScaffold";
import {
  Building2,
  CalendarClock,
  Filter,
  Info,
  MapPin,
  Star,
  Users,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLiveLocation } from "@/hooks/useLiveLocation";
import { ClinicDistance } from "@/components/ClinicDistance";
import { useAddressSearch } from "@/hooks/useAddressSearch";
import { useTranslation } from "@/lib/i18n";
import { formatAvailabilityForLanguage } from "@/lib/time-format";
import { useClinics } from "@/lib/clinic-data";
import { getSpecializationLabel, matchSpecialization } from "@/lib/specializations";
import { TranslatedText } from "@/components/TranslatedText";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const WOUND_CARE_TOOLTIP =
  "Minor injury treatment (cuts, burns, sprains, wound dressing) during clinic hours. Not ER care.";

export default function Clinics() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const {
    currentLocation,
    locationError,
    isFetchingLocation,
    manualLocation,
    setManualLocation,
    clearManualLocation,
    coordinates,
  } = useLiveLocation();
  const { t, language } = useTranslation();
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [manualLocationInput, setManualLocationInput] = useState(manualLocation ?? "");
  const [manualLocationError, setManualLocationError] = useState("");
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const {
    suggestions,
    isLoading: isSuggesting,
    error: suggestionError,
    fetchPlaceDetails,
    geocodeAddress,
  } = useAddressSearch(manualLocationInput);

  const specializationParam = searchParams.get("specialization");
  const normalizedSpecialization = specializationParam
    ? matchSpecialization(specializationParam) ?? specializationParam
    : null;

  const { data: clinicsData, isLoading: isClinicsLoading } = useClinics();
  const baseSpecializations = useMemo(() => {
    const specializationMap = new Map<string, string>();
    (clinicsData?.clinics ?? []).forEach((clinic) => {
      clinic.specializations.forEach((spec) => {
        const normalized = matchSpecialization(spec) ?? spec;
        if (!specializationMap.has(normalized)) {
          specializationMap.set(normalized, getSpecializationLabel(normalized));
        }
      });
    });

    return Array.from(specializationMap.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [clinicsData?.clinics]);

  const availableSpecializations = useMemo(() => {
    const baseList = [
      { id: "all", label: t("All specializations") },
      ...baseSpecializations,
    ];
    if (!normalizedSpecialization) return baseList;

    const exists = baseSpecializations.some(
      (spec) => spec.id.toLowerCase() === normalizedSpecialization.toLowerCase(),
    );

    return exists
      ? baseList
      : [
          ...baseList,
          { id: normalizedSpecialization, label: normalizedSpecialization },
        ];
  }, [baseSpecializations, normalizedSpecialization, t]);

  const selectedSpecialization =
    availableSpecializations.find(
      (spec) => spec.id.toLowerCase() === (normalizedSpecialization ?? "").toLowerCase()
    )?.id ?? availableSpecializations[0]?.id ?? "all";

  const clinics = useMemo(
    () =>
      (clinicsData?.clinics ?? []).filter((clinic) => {
        const specializationMatch =
          selectedSpecialization === "all"
            ? true
            : clinic.specializations.some((spec) => {
                const normalized = matchSpecialization(spec) ?? spec;
                return normalized.toLowerCase() === selectedSpecialization.toLowerCase();
              });
        const ratingMatch = clinic.rating >= minRating;

        return specializationMatch && ratingMatch;
      }),
    [clinicsData?.clinics, selectedSpecialization, minRating]
  );

  const selectedLabel =
    availableSpecializations.find((spec) => spec.id === selectedSpecialization)?.label ?? selectedSpecialization;
  const translatedSelectedLabel = t(selectedLabel);

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

  const handleSpecializationChange = (specialization: string) => {
    setSearchParams({ specialization });
    setShowFilters(false);
  };

  if (isClinicsLoading) {
    return (
      <PageScaffold contentClassName="pb-28 lg:pb-12">
        <LoadingScreen
          title={t("Loading clinics")}
          subtitle={t("Fetching the latest availability from nearby providers.")}
        />
      </PageScaffold>
    );
  }

  return (
    <PageScaffold contentClassName="pb-28 lg:pb-12">
      <header className="bg-white px-4 pt-14 pb-4 border-b border-gray-100 shadow-sm lg:px-10 lg:rounded-t-3xl lg:border-none lg:shadow-none">
        <div className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("Clinics")}</p>
          <h1 className="text-3xl font-bold text-[#002D55] flex items-center gap-3">
            <Building2 className="hidden lg:block w-8 h-8 text-[#0089FF]" /> {t("Discover care for")} {translatedSelectedLabel}
          </h1>
          <p className="text-sm text-slate-500">
            {clinics.length} {t("options in Beppu updated just now based on your specialty.")}
          </p>
          <div className="mt-1 flex items-start gap-3 rounded-2xl bg-[#E8F3FF] p-4 shadow-sm w-full lg:max-w-xl">
            <div className="rounded-xl bg-white p-2 shadow-sm">
              <MapPin className="w-5 h-5 text-[#0089FF]" />
            </div>
            <div className="space-y-0.5">
              <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">{t("Live location")}</p>
              <p className={`text-sm font-semibold leading-tight ${locationError ? "text-red-500" : "text-[#002D55]"}`}>
                {locationLabel}
              </p>
              <p className={`text-xs ${locationError ? "text-red-500" : "text-slate-600"}`}>{t(locationStatus)}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {manualLocation && (
                  <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-[#1648CE]">
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
      </header>

      <main className="flex-1 px-4 pt-6 lg:px-12 lg:pt-12">
        <div className="lg:grid lg:grid-cols-[3fr_1.05fr] lg:gap-12">
          <section className="space-y-6">
            <div className="rounded-3xl border border-[#D4EBFF] bg-white p-6 shadow-sm lg:p-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-[#002D55]">{translatedSelectedLabel} {t("specialists near you")}</p>
                  <h2 className="text-2xl font-bold text-[#002D55]">
                    {clinics.length} {t("care centers available in Beppu")}
                  </h2>
                  <p className="text-sm text-slate-600">{t("Filter by specialization and rating to narrow the list.")}</p>
                </div>
                <button
                  onClick={() => setShowFilters((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-[#002D55] hover:border-[#3A12DB] hover:text-[#3A12DB] lg:hidden"
                >
                  <Filter className="w-4 h-4" /> {showFilters ? "Hide" : "Show"} filters
                </button>
              </div>

              <div
                className={`${
                  showFilters ? "grid" : "hidden lg:grid"
                } mt-4 grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-2`}
              >
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="specialization">
                    {t("Specialization")}
                  </label>
                  <select
                    id="specialization"
                    value={selectedSpecialization}
                    onChange={(e) => handleSpecializationChange(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-[#3A12DB] focus:outline-none"
                  >
                    {availableSpecializations.map((spec) => (
                      <option key={spec.id} value={spec.id}>
                        {t(spec.label)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="rating">
                    {t("Minimum rating")}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      id="rating"
                      type="range"
                      min={0}
                      max={5}
                      step={0.1}
                      value={minRating}
                      onChange={(e) => setMinRating(Number(e.target.value))}
                      className="flex-1 accent-[#3A12DB]"
                    />
                    <span className="flex items-center gap-1 rounded-full bg-[#F1EDFF] px-3 py-1 text-xs font-semibold text-[#3A12DB] shadow-sm">
                      <Star className="w-4 h-4" /> {minRating.toFixed(1)}+
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{t("Drag to prioritise higher-rated doctors.")}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
              {clinics.map((clinic) => {
                const visibleSpecializations = clinic.specializations.slice(0, 4);
                const remaining = clinic.specializations.length - visibleSpecializations.length;

                return (
                  <article
                    key={clinic.id}
                    className="flex h-full flex-col overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-[0_10px_35px_rgba(21,47,81,0.05)]"
                  >
                    <div className="h-40 w-full overflow-hidden">
                      <img src={clinic.image} alt={clinic.name} className="h-full w-full object-cover" />
                    </div>
                    <div className="flex flex-1 flex-col gap-4 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-semibold text-[#002D55]">
                            <TranslatedText text={clinic.name} />
                          </h3>
                          {clinic.immediateWoundCare && (
                            <div className="mt-2 flex items-center gap-2">
                              <Badge variant="outline" className="border-slate-200 text-slate-700">
                                {t("Immediate Wound Care")}
                              </Badge>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    className="text-slate-400 hover:text-slate-600"
                                    aria-label={t("Immediate Wound Care info")}
                                  >
                                    <Info className="h-4 w-4" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs text-xs">
                                  {t(WOUND_CARE_TOOLTIP)}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                        {clinic.patients ? (
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4 text-[#0089FF]" /> {clinic.patients}
                          </div>
                        ) : null}
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4 text-[#0089FF]" />
                          <TranslatedText text={clinic.location} inline />
                          {(clinic.googlePlaceId || clinic.distance) ? (
                            <>
                              <span className="text-slate-300">·</span>
                              <ClinicDistance
                                placeId={clinic.googlePlaceId}
                                userCoordinates={coordinates}
                                fallback={clinic.distance}
                              />
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs font-semibold text-[#3A12DB]">
                        {visibleSpecializations.map((spec) => (
                          <span key={spec} className="rounded-full bg-[#F1EDFF] px-3 py-1">
                            {t(spec)}
                          </span>
                        ))}
                        {remaining > 0 && (
                          <span className="rounded-full bg-[#E4F2FF] px-3 py-1 text-[#1648CE]">+{remaining} more</span>
                        )}
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <CalendarClock className="w-4 h-4 text-[#0089FF]" /> {t("Next availability")}:{" "}
                          {formatAvailabilityForLanguage(clinic.nextAvailability, language, t)}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => navigate(`/clinics/${clinic.id}`)}
                            className="inline-flex items-center justify-center rounded-2xl border border-[#1648CE] px-4 py-2 text-sm font-semibold text-[#1648CE] transition-colors hover:bg-[#E8F0FF]"
                          >
                            {t("View clinic")}
                          </button>
                          <button
                            onClick={() =>
                              navigate(
                                `/appointment?view=booking&clinic=${clinic.id}&specialization=${encodeURIComponent(
                                  selectedSpecialization
                                )}`
                              )
                            }
                            className="inline-flex items-center justify-center rounded-2xl bg-[#1648CE] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#1648CE]/30 transition-colors hover:bg-[#0F3499]"
                          >
                            {t("Book appointment")}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}

              {clinics.length === 0 && (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-8 text-center text-sm text-slate-500 md:col-span-2">
                  {t(
                    "No clinics match this specialty yet. Try another selection or chat with DocDaisy."
                  )}
                </div>
              )}
            </div>
          </section>

          <aside className="hidden lg:flex flex-col gap-5">
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-400">{t("Why these clinics?")}</p>
              <h4 className="text-lg font-semibold text-[#002D55] mt-2">{t("Curated with DocDaisy")}</h4>
              <p className="text-sm text-slate-600 mt-2">
                {t("We prioritise availability, distance and patient reviews.")}
              </p>
            </div>
            <DocDaisyBanner variant="card" onClick={() => navigate("/docdaisy")} />
            
          </aside>
        </div>
      </main>

      <div className="lg:hidden">
        <BottomNav />
      </div>
    </PageScaffold>
  );
}
