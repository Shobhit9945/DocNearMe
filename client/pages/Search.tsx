import { BottomNav } from "@/components/BottomNav";
import { PageScaffold } from "@/components/PageScaffold";
import { Search as SearchIcon, Stethoscope, Building2, Star, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { formatAvailabilityForLanguage } from "@/lib/time-format";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAllDoctors, useClinics } from "@/lib/clinic-data";
import { formatShortAddress } from "@/lib/address";
import { getSpecializationLabel, matchSpecialization } from "@/lib/specializations";
import { TranslatedText } from "@/components/TranslatedText";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useLiveLocation } from "@/hooks/useLiveLocation";
import { useAddressSearch } from "@/hooks/useAddressSearch";
import { formatDistanceLabel, getDistanceKm } from "@/lib/distance";

export default function Search() {
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [specializationFilter, setSpecializationFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [locationInput, setLocationInput] = useState("");
  const [selectedLocationLabel, setSelectedLocationLabel] = useState("");
  const [locationCoordinates, setLocationCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState("");
  const [distanceFilter, setDistanceFilter] = useState("any");
  const [resultType, setResultType] = useState<"all" | "doctor" | "clinic">("all");
  const [isFiltersOpen, setIsFiltersOpen] = useState(true);
  const { data: clinicsData, isLoading: isClinicsLoading } = useClinics();
  const { data: doctorsData, isLoading: isDoctorsLoading } = useAllDoctors();
  const { coordinates } = useLiveLocation();
  const {
    suggestions: locationSuggestions,
    isLoading: isLocationLoading,
    error: locationSuggestionsError,
  } = useAddressSearch(locationInput);
  const [distanceMap, setDistanceMap] = useState<Record<string, number>>({});
  const doctorScrollerRef = useRef<HTMLDivElement | null>(null);
  const clinicScrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const qParam = searchParams.get("q") ?? "";
    setQuery((current) => (current === qParam ? current : qParam));
  }, [searchParams]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    const currentParam = searchParams.get("q") ?? "";
    if (trimmedQuery === currentParam) {
      return;
    }
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (trimmedQuery) {
        next.set("q", trimmedQuery);
      } else {
        next.delete("q");
      }
      return next;
    }, { replace: true });
  }, [query, searchParams, setSearchParams]);

  const normalizedQuery = query.trim().toLowerCase();
  const specializations = useMemo(() => {
    const specializationMap = new Map<string, string>();
    (clinicsData?.clinics ?? []).forEach((clinic) => {
      clinic.specializations.forEach((spec) => {
        const normalized = matchSpecialization(spec) ?? spec;
        if (!specializationMap.has(normalized)) {
          specializationMap.set(normalized, getSpecializationLabel(normalized));
        }
      });
    });
    const dynamicOptions = Array.from(specializationMap.entries())
      .map(([id, label]) => ({ id, label: t(label) }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return [{ id: "all", label: t("All specializations") }, ...dynamicOptions];
  }, [clinicsData?.clinics, t]);

  const normalizedSpecialization =
    specializationFilter === "all"
      ? null
      : matchSpecialization(specializationFilter) ?? specializationFilter;

  const languageOptions = useMemo(() => {
    const languageSet = new Set<string>();
    (doctorsData?.doctors ?? []).forEach((doctor) => {
      doctor.languages.forEach((language) => languageSet.add(language));
    });
    const options = Array.from(languageSet).sort((a, b) => a.localeCompare(b));
    return ["all", ...options];
  }, [doctorsData?.doctors]);

  const normalizedLanguage = languageFilter === "all" ? null : languageFilter.toLowerCase();

  const normalizedDistance = distanceFilter === "any" ? null : Number(distanceFilter);
  const baseCoordinates = locationCoordinates ?? coordinates;
  const showLocationSuggestions =
    locationInput.trim().length >= 3 &&
    locationSuggestions.length > 0 &&
    locationInput.trim() !== selectedLocationLabel.trim();

  const handleLocationChange = (value: string) => {
    setLocationInput(value);
    if (value.trim() !== selectedLocationLabel.trim()) {
      setSelectedLocationLabel("");
      setLocationCoordinates(null);
      setLocationError("");
    }
  };

  const handleSelectLocation = async (description: string, placeId: string) => {
    setLocationInput(description);
    setSelectedLocationLabel(description);
    setLocationError("");

    try {
      const response = await fetch(
        `/api/google-maps/places/details?placeId=${encodeURIComponent(placeId)}`,
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error("Unable to load location details.");
      }
      const location = data?.result?.geometry?.location;
      if (!location?.lat || !location?.lng) {
        throw new Error("Location coordinates were not available.");
      }
      setLocationCoordinates({ lat: location.lat, lng: location.lng });
    } catch (error) {
      setLocationCoordinates(null);
      setLocationError(error instanceof Error ? error.message : t("Unable to set location."));
    }
  };

  useEffect(() => {
    if (!baseCoordinates || !(clinicsData?.clinics ?? []).length) return;
    let cancelled = false;

    const loadDistances = async () => {
      const entries = await Promise.all(
        (clinicsData?.clinics ?? []).map(async (clinic) => {
          if (!clinic.googlePlaceId) return null;
          try {
            const response = await fetch(
              `/api/google-maps/places/details?placeId=${encodeURIComponent(clinic.googlePlaceId)}`,
            );
            if (!response.ok) return null;
            const data = await response.json();
            const location = data?.result?.geometry?.location;
            if (!location?.lat || !location?.lng) return null;
            const km = getDistanceKm(baseCoordinates, { lat: location.lat, lng: location.lng });
            return [clinic.id, km] as const;
          } catch {
            return null;
          }
        }),
      );

      if (cancelled) return;
      const map: Record<string, number> = {};
      entries.filter(Boolean).forEach((entry) => {
        if (!entry) return;
        map[entry[0]] = entry[1];
      });
      setDistanceMap(map);
    };

    void loadDistances();
    return () => {
      cancelled = true;
    };
  }, [baseCoordinates, clinicsData?.clinics]);

  const clinicLanguages = useMemo(() => {
    const map = new Map<string, Set<string>>();
    (doctorsData?.doctors ?? []).forEach((doctor) => {
      const existing = map.get(doctor.clinicId) ?? new Set<string>();
      doctor.languages.forEach((language) => existing.add(language.toLowerCase()));
      map.set(doctor.clinicId, existing);
    });
    return map;
  }, [doctorsData?.doctors]);

  const filteredClinics = useMemo(() => {
    return (clinicsData?.clinics ?? []).filter((clinic) => {
      const matchesQuery =
        !normalizedQuery ||
        clinic.name.toLowerCase().includes(normalizedQuery) ||
        clinic.location.toLowerCase().includes(normalizedQuery) ||
        clinic.specializations.some((spec) => spec.toLowerCase().includes(normalizedQuery));
      const matchesSpecialization = normalizedSpecialization
        ? clinic.specializations.some(
            (spec) => (matchSpecialization(spec) ?? spec).toLowerCase() === normalizedSpecialization.toLowerCase(),
          )
        : true;
      const matchesLanguage = normalizedLanguage
        ? (clinicLanguages.get(clinic.id) ?? new Set<string>()).has(normalizedLanguage)
        : true;
      const distanceKm = distanceMap[clinic.id];
      const matchesDistance = normalizedDistance && baseCoordinates
        ? typeof distanceKm === "number" && distanceKm <= normalizedDistance
        : true;
      return matchesQuery && matchesSpecialization && matchesLanguage && matchesDistance;
    });
  }, [
    clinicLanguages,
    clinicsData?.clinics,
    normalizedQuery,
    normalizedLanguage,
    normalizedSpecialization,
    normalizedDistance,
    distanceMap,
    baseCoordinates,
  ]);

  const filteredDoctors = useMemo(() => {
    return (doctorsData?.doctors ?? []).filter((doctor) => {
      const clinic = clinicsData?.clinics?.find((entry) => entry.id === doctor.clinicId);
      const matchesQuery =
        !normalizedQuery ||
        doctor.name.toLowerCase().includes(normalizedQuery) ||
        doctor.specialization.toLowerCase().includes(normalizedQuery) ||
        clinic?.name.toLowerCase().includes(normalizedQuery);
      const matchesSpecialization = normalizedSpecialization
        ? (matchSpecialization(doctor.specialization) ?? doctor.specialization)
            .toLowerCase()
            .includes(normalizedSpecialization.toLowerCase())
        : true;
      const matchesLanguage = normalizedLanguage
        ? doctor.languages.some((language) => language.toLowerCase() === normalizedLanguage)
        : true;
      return matchesQuery && matchesSpecialization && matchesLanguage;
    });
  }, [clinicsData?.clinics, doctorsData?.doctors, normalizedQuery, normalizedLanguage, normalizedSpecialization]);

  const visibleClinics = resultType === "doctor" ? [] : filteredClinics;
  const visibleDoctors = resultType === "clinic" ? [] : filteredDoctors;
  const scrollerCardClass =
    "flex-none min-w-[85%] sm:min-w-[60%] md:min-w-[45%] lg:min-w-0 lg:w-auto lg:flex-auto snap-start";

  const scrollScroller = (scroller: HTMLDivElement | null, direction: "left" | "right") => {
    if (!scroller) return;
    const offset = Math.max(scroller.clientWidth * 0.85, 280);
    scroller.scrollBy({ left: direction === "left" ? -offset : offset, behavior: "smooth" });
  };

  if (isClinicsLoading || isDoctorsLoading) {
    return (
      <PageScaffold contentClassName="pb-28 lg:pb-12">
        <LoadingScreen
          title={t("Loading search")}
          subtitle={t("Preparing clinics and doctors for you.")}
        />
      </PageScaffold>
    );
  }

  return (
    <PageScaffold contentClassName="pb-28 lg:pb-12">
      <header className="bg-white px-4 pt-14 pb-4 border-b border-gray-100 shadow-sm lg:px-10 lg:rounded-t-3xl lg:border-none lg:shadow-none">
        <h1 className="text-2xl font-bold text-[#002D55]">{t("Search")}</h1>
        <p className="text-sm text-slate-500 mt-2">{t("specialists, clinics and hospitals nearby.")}</p>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 lg:px-8 lg:pt-10 2xl:max-w-7xl">
        <div className="flex flex-col gap-6 lg:flex-row">
          <section className="flex-1 space-y-6">
            <div className="rounded-[24px] border border-slate-100 bg-white p-6 shadow-sm lg:p-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-[#002D55]">{t("Find care fast")}</h2>
                  <p className="text-sm text-slate-500">
                    {t("Search by doctor, clinic, or specialization in Beppu.")}
                  </p>
                </div>
                <div className="inline-flex rounded-full bg-[#E8F3FF] px-4 py-2 text-xs font-semibold text-[#1648CE]">
                  {visibleDoctors.length + visibleClinics.length} {t("matches")}
                </div>
                </div>
              <div
                id="search-filters"
                className={`${isFiltersOpen ? "grid" : "hidden"} mt-5 gap-4 lg:grid lg:grid-cols-2 2xl:grid-cols-[2fr_1fr_1fr_1fr_1fr]`}
              >
                <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
                  {t("Location")}
                  <div className="relative">
                    <input
                      value={locationInput}
                      onChange={(event) => handleLocationChange(event.target.value)}
                      placeholder={t("Enter city or address")}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-[#0089FF] focus:outline-none"
                    />
                    {showLocationSuggestions ? (
                      <div className="absolute z-10 mt-2 w-full rounded-2xl border border-slate-200 bg-white shadow-lg">
                        {locationSuggestions.map((suggestion) => (
                          <button
                            key={suggestion.placeId}
                            type="button"
                            onClick={() => handleSelectLocation(suggestion.description, suggestion.placeId)}
                            className="block w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                          >
                            {suggestion.description}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {isLocationLoading ? (
                    <span className="text-xs text-slate-400">{t("Searching locations...")}</span>
                  ) : null}
                  {locationSuggestionsError ? (
                    <span className="text-xs text-red-500">{locationSuggestionsError}</span>
                  ) : null}
                  {locationError ? (
                    <span className="text-xs text-red-500">{locationError}</span>
                  ) : null}
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
                  {t("Search term")}
                  <div className="relative">
                    <SearchIcon className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder={t("Search doctors, clinics, or services")}
                      className="w-full rounded-2xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 shadow-sm focus:border-[#0089FF] focus:outline-none"
                    />
                  </div>
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
                  {t("Specialization")}
                  <select
                    value={specializationFilter}
                    onChange={(event) => setSpecializationFilter(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-[#0089FF] focus:outline-none"
                  >
                    {specializations.map((specialization) => (
                      <option key={specialization.id} value={specialization.id}>
                        {specialization.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
                  {t("Language")}
                  <select
                    value={languageFilter}
                    onChange={(event) => setLanguageFilter(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-[#0089FF] focus:outline-none"
                  >
                    {languageOptions.map((language) => (
                      <option key={language} value={language}>
                        {language === "all" ? t("All languages") : t(language)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
                  {t("Distance")}
                  <select
                    value={distanceFilter}
                    onChange={(event) => setDistanceFilter(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-[#0089FF] focus:outline-none"
                  >
                    <option value="any">{t("Any distance")}</option>
                    <option value="2">{t("Within 2 km")}</option>
                    <option value="5">{t("Within 5 km")}</option>
                    <option value="10">{t("Within 10 km")}</option>
                    <option value="20">{t("Within 20 km")}</option>
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
                  {t("Result type")}
                  <div className="flex gap-2">
                    {[
                      { id: "all", label: "All" },
                      { id: "doctor", label: "Doctors" },
                      { id: "clinic", label: "Clinics" },
                    ].map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setResultType(option.id as typeof resultType)}
                        className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold transition-colors ${
                          resultType === option.id
                            ? "bg-[#002D55] text-white"
                            : "bg-white text-slate-600 border border-slate-200"
                        }`}
                      >
                        {t(option.label)}
                      </button>
                    ))}
                  </div>
                </label>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsFiltersOpen((current) => !current)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:border-[#1648CE] hover:text-[#1648CE] lg:hidden"
              aria-expanded={isFiltersOpen}
              aria-controls="search-filters"
            >
              {isFiltersOpen ? t("Hide filters") : t("Show filters")}
              {isFiltersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            <div className="space-y-4">
              {visibleDoctors.length > 0 && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-[#002D55]">{t("Doctors")}</h3>
                    <div className="flex items-center gap-2 lg:hidden">
                      <button
                        type="button"
                        onClick={() => scrollScroller(doctorScrollerRef.current, "left")}
                        className="rounded-full border border-slate-200 p-2 text-[#002D55] shadow-sm hover:border-[#1648CE] hover:text-[#1648CE]"
                        aria-label="Scroll doctors left"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollScroller(doctorScrollerRef.current, "right")}
                        className="rounded-full border border-slate-200 p-2 text-[#002D55] shadow-sm hover:border-[#1648CE] hover:text-[#1648CE]"
                        aria-label="Scroll doctors right"
                      >
                        →
                      </button>
                    </div>
                  </div>
                  <div
                    ref={doctorScrollerRef}
                    className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 pt-1 lg:grid lg:grid-cols-2 lg:gap-6 lg:overflow-visible lg:pb-0 lg:snap-none 2xl:grid-cols-3"
                  >
                    {visibleDoctors.map((doctor) => {
                      const clinic = clinicsData?.clinics?.find((entry) => entry.id === doctor.clinicId);
                      return (
                        <article
                          key={doctor.id}
                          className={`${scrollerCardClass} rounded-3xl border border-slate-100 bg-white p-5 shadow-sm`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-lg font-semibold text-[#002D55]">
                                <TranslatedText text={doctor.name} />
                              </p>
                              <p className="text-sm text-slate-500">{t(doctor.specialization)}</p>
                              <p className="text-sm text-slate-500">
                                {clinic ? <TranslatedText text={clinic.name} inline /> : t("Clinic")}
                              </p>
                            </div>
                            <span className="flex items-center gap-1 rounded-full bg-[#FFF3C8] px-3 py-1 text-xs font-semibold text-[#B06B00]">
                              <Star className="h-4 w-4" fill="#B06B00" /> {doctor.rating.toFixed(1)}
                            </span>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-[#3A12DB]">
                            {doctor.languages.map((language) => (
                              <span key={language} className="rounded-full bg-[#F1EDFF] px-3 py-1">
                                {t(language)}
                              </span>
                            ))}
                          </div>
                          <p className="mt-3 text-sm text-slate-500">
                            {t("Next availability")}: {formatAvailabilityForLanguage(doctor.nextAvailable, language, t)}
                          </p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => navigate(`/clinics/${doctor.clinicId}`)}
                              className="rounded-full border border-[#1648CE] px-4 py-2 text-xs font-semibold text-[#1648CE] hover:bg-[#E8F0FF]"
                            >
                              {t("View clinic")}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                navigate(
                                  `/appointment?view=booking&clinic=${doctor.clinicId}&specialization=${encodeURIComponent(
                                    doctor.specialization,
                                  )}`,
                                )
                              }
                              className="rounded-full bg-[#1648CE] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-[#1648CE]/20"
                            >
                              {t("Book appointment")}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}

              {visibleClinics.length > 0 && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-[#002D55]">{t("Clinics")}</h3>
                    <div className="flex items-center gap-2 lg:hidden">
                      <button
                        type="button"
                        onClick={() => scrollScroller(clinicScrollerRef.current, "left")}
                        className="rounded-full border border-slate-200 p-2 text-[#002D55] shadow-sm hover:border-[#1648CE] hover:text-[#1648CE]"
                        aria-label="Scroll clinics left"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollScroller(clinicScrollerRef.current, "right")}
                        className="rounded-full border border-slate-200 p-2 text-[#002D55] shadow-sm hover:border-[#1648CE] hover:text-[#1648CE]"
                        aria-label="Scroll clinics right"
                      >
                        →
                      </button>
                    </div>
                  </div>
                  <div
                    ref={clinicScrollerRef}
                    className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 pt-1 lg:grid lg:grid-cols-2 lg:gap-6 lg:overflow-visible lg:pb-0 lg:snap-none 2xl:grid-cols-3"
                  >
                    {visibleClinics.map((clinic) => (
                      <article
                        key={clinic.id}
                        className={`${scrollerCardClass} rounded-3xl border border-slate-100 bg-white p-5 shadow-sm`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-semibold text-[#002D55]">
                              <TranslatedText text={clinic.name} />
                            </p>
                            <p className="text-sm text-slate-500">
                              <TranslatedText text={formatShortAddress(clinic.location)} inline />
                            </p>
                          </div>
                          <span className="flex items-center gap-1 rounded-full bg-[#FFF3C8] px-3 py-1 text-xs font-semibold text-[#B06B00]">
                            <Star className="h-4 w-4" fill="#B06B00" /> {clinic.rating.toFixed(1)}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-[#3A12DB]">
                          {clinic.specializations.slice(0, 4).map((spec) => (
                            <span key={spec} className="rounded-full bg-[#F1EDFF] px-3 py-1">
                              {t(spec)}
                            </span>
                          ))}
                        </div>
                        {(() => {
                          const distanceKm = distanceMap[clinic.id];
                          const distanceLabel =
                            typeof distanceKm === "number"
                              ? formatDistanceLabel(distanceKm)
                              : clinic.distance;
                          const normalizedDistanceLabel = distanceLabel
                            ? /away$/i.test(distanceLabel)
                              ? distanceLabel
                              : `${distanceLabel} ${t("away")}`
                            : "";
                          return normalizedDistanceLabel ? (
                            <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                              {normalizedDistanceLabel}
                            </p>
                          ) : null;
                        })()}
                        <p className="mt-3 text-sm text-slate-500">
                          {t("Next availability")}: {formatAvailabilityForLanguage(clinic.nextAvailability, language, t)}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/clinics/${clinic.id}`)}
                            className="rounded-full border border-[#1648CE] px-4 py-2 text-xs font-semibold text-[#1648CE] hover:bg-[#E8F0FF]"
                          >
                            {t("View clinic")}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                `/appointment?view=booking&clinic=${clinic.id}&specialization=${encodeURIComponent(
                                  clinic.specializations[0] ?? "",
                                )}`,
                              )
                            }
                            className="rounded-full bg-[#1648CE] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-[#1648CE]/20"
                          >
                            {t("Book appointment")}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {visibleClinics.length === 0 && visibleDoctors.length === 0 && (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-white/80 p-8 text-center text-sm text-slate-500">
                  {t("No matches yet. Try another search or adjust filters.")}
                </div>
              )}
            </div>
          </section>

          <aside className="hidden lg:flex lg:w-[260px] xl:w-[300px] flex-col gap-4">
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#002D55]">
                <Stethoscope className="h-4 w-4 text-[#0089FF]" /> {t("Search tips")}
              </div>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <Building2 className="h-4 w-4 text-[#0089FF]" /> {t("Search by clinic name or neighborhood.")}
                </li>
                <li className="flex items-start gap-2">
                  <Stethoscope className="h-4 w-4 text-[#0089FF]" /> {t("Try a specialization like Dermatology.")}
                </li>
                <li className="flex items-start gap-2">
                  <SearchIcon className="h-4 w-4 text-[#0089FF]" /> {t("Filter results to focus on doctors or clinics.")}
                </li>
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-[#F8FBFF] p-6">
              <p className="text-sm text-slate-600">
                {t("Need urgent help finding a doctor? Start a conversation with DocDaisy to get a recommendation instantly.")}
              </p>
            </div>
          </aside>
        </div>
      </main>

      <div className="lg:hidden">
        <BottomNav />
      </div>
    </PageScaffold>
  );
}
