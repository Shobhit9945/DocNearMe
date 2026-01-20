import { useMemo, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { DocDaisyBanner } from "@/components/DocDaisyBanner";
import { PageScaffold } from "@/components/PageScaffold";
import {
  Building2,
  CalendarClock,
  Filter,
  MapPin,
  Star,
  Users,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLiveLocation } from "@/hooks/useLiveLocation";
import { useTranslation } from "@/lib/i18n";
import { CLINICS } from "@/lib/clinics";
import { matchSpecialization, SPECIALIZATION_OPTIONS } from "@/lib/specializations";

const BASE_SPECIALIZATIONS = SPECIALIZATION_OPTIONS.map(({ id, label }) => ({
  id,
  label,
}));

export default function Clinics() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const { currentLocation, locationError, isFetchingLocation } = useLiveLocation();
  const { t } = useTranslation();

  const specializationParam = searchParams.get("specialization");
  const normalizedSpecialization = specializationParam
    ? matchSpecialization(specializationParam) ?? specializationParam
    : null;

  const availableSpecializations = useMemo(() => {
    if (!normalizedSpecialization) return BASE_SPECIALIZATIONS;

    const exists = BASE_SPECIALIZATIONS.some(
      (spec) => spec.id.toLowerCase() === normalizedSpecialization.toLowerCase()
    );

    return exists
      ? BASE_SPECIALIZATIONS
      : [
          ...BASE_SPECIALIZATIONS,
          { id: normalizedSpecialization, label: normalizedSpecialization },
        ];
  }, [normalizedSpecialization]);

  const selectedSpecialization =
    availableSpecializations.find(
      (spec) => spec.id.toLowerCase() === (normalizedSpecialization ?? "").toLowerCase()
    )?.id ?? availableSpecializations[0].id;

  const clinics = useMemo(
    () =>
      CLINICS.filter((clinic) => {
        const specializationMatch = clinic.specializations.some((spec) => {
          const normalized = matchSpecialization(spec) ?? spec;
          return normalized.toLowerCase() === selectedSpecialization.toLowerCase();
        });
        const ratingMatch = clinic.rating >= minRating;

        return specializationMatch && ratingMatch;
      }),
    [selectedSpecialization, minRating]
  );

  const selectedLabel =
    availableSpecializations.find((spec) => spec.id === selectedSpecialization)?.label ?? selectedSpecialization;

  const locationStatus = useMemo(() => {
    if (isFetchingLocation) return "Fetching your location...";
    if (locationError) return locationError;
    return "Updated a moment ago";
  }, [isFetchingLocation, locationError]);

  const handleSpecializationChange = (specialization: string) => {
    setSearchParams({ specialization });
    setShowFilters(false);
  };

  return (
    <PageScaffold contentClassName="pb-28 lg:pb-12">
      <header className="bg-white px-4 pt-10 pb-4 border-b border-gray-100 shadow-sm lg:px-10 lg:rounded-t-3xl lg:border-none lg:shadow-none">
        <div className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("Clinics")}</p>
          <h1 className="text-3xl font-bold text-[#002D55] flex items-center gap-3">
            <Building2 className="w-8 h-8 text-[#0089FF]" /> {t("Discover care for")} {selectedLabel}
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
                {currentLocation}
              </p>
              <p className={`text-xs ${locationError ? "text-red-500" : "text-slate-600"}`}>{t(locationStatus)}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pt-6 lg:px-12 lg:pt-12">
        <div className="lg:grid lg:grid-cols-[3fr_1.05fr] lg:gap-12">
          <section className="space-y-6">
            <div className="rounded-3xl border border-[#D4EBFF] bg-gradient-to-br from-white to-[#E4F2FF] p-6 shadow-sm lg:p-10">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-[#002D55]">{selectedLabel} {t("specialists near you")}</p>
                  <h2 className="text-2xl font-bold text-[#002D55]">
                    {clinics.length} {t("care centers available in Beppu")}
                  </h2>
                  <p className="text-sm text-slate-600">{t("Refined by DocDaisy and your latest filters.")}</p>
                </div>
                <div className="rounded-2xl bg-white/80 p-4 text-sm text-slate-700 shadow-sm max-w-sm">
                  <p className="font-semibold text-[#002D55]">DocDaisy insights</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Use the filters below to refine specialists around your live location before starting a search.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowFilters((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-[#002D55] hover:border-[#3A12DB] hover:text-[#3A12DB] lg:hidden"
              >
                <Filter className="w-4 h-4" /> {showFilters ? "Hide" : "Show"} filters
              </button>
            </div>

            <div
              className={`${showFilters ? "grid" : "hidden lg:grid"} grid-cols-1 gap-4 border-t border-slate-100 px-4 py-4 sm:grid-cols-2 lg:grid-cols-2 lg:px-6 lg:py-6`}
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
                        {spec.label}
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
                          <h3 className="text-xl font-semibold text-[#002D55]">{clinic.name}</h3>
                        </div>
                        <div className="flex items-center gap-1 rounded-full bg-[#FFF3C8] px-3 py-1 text-sm font-semibold text-[#B06B00]">
                          <Star className="w-4 h-4" fill="#B06B00" /> {clinic.rating}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4 text-[#0089FF]" /> {clinic.patients}
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4 text-[#0089FF]" /> {clinic.location} · {clinic.distance}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs font-semibold text-[#3A12DB]">
                        {visibleSpecializations.map((spec) => (
                          <span key={spec} className="rounded-full bg-[#F1EDFF] px-3 py-1">
                            {spec}
                          </span>
                        ))}
                        {remaining > 0 && (
                          <span className="rounded-full bg-[#E4F2FF] px-3 py-1 text-[#1648CE]">+{remaining} more</span>
                        )}
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <CalendarClock className="w-4 h-4 text-[#0089FF]" /> {t("Next availability")}: {clinic.nextAvailability}
                        </div>
                        <button
                          onClick={() =>
                            navigate(
                              `/appointment?view=booking&clinic=${clinic.id}&specialization=${encodeURIComponent(
                                selectedSpecialization
                              )}`
                            )
                          }
                          className="inline-flex items-center justify-center rounded-2xl bg-[#1648CE] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#1648CE]/30 transition-colors hover:bg-[#0F3499]"
                        >
                          {t("Book appointment")}
                        </button>
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
            <div className="rounded-3xl border border-[#D4EBFF] bg-[#F5FAFF] p-6 text-sm text-slate-600">
              <p className="font-semibold text-[#002D55]">{t("Need directions?")}</p>
              <p className="mt-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#0089FF]" /> {t("Open in Maps")}
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
