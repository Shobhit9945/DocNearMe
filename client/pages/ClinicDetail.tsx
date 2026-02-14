import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BottomNav } from "@/components/BottomNav";
import { PageScaffold } from "@/components/PageScaffold";
import { DocDaisyBanner } from "@/components/DocDaisyBanner";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useClinicDoctors, useClinicProfile } from "@/lib/clinic-data";
import { useTranslation } from "@/lib/i18n";
import { formatAvailabilityForLanguage } from "@/lib/time-format";
import { GoogleReviews } from "@/components/GoogleReviews";
import { useGooglePlaceDetails } from "@/hooks/useGooglePlaceDetails";
import { TranslatedText } from "@/components/TranslatedText";
import { CalendarClock, Info, MapPin, Star, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type {
  ClinicReviewListResponse,
} from "@shared/api";

const WOUND_CARE_TOOLTIP =
  "Minor injury treatment (cuts, burns, sprains, wound dressing) during clinic hours. Not ER care.";
const CLINIC_IMAGE_FALLBACK = "/applogo.png";

export default function ClinicDetail() {
  const { clinicId } = useParams<{ clinicId: string }>();
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const { data: clinicData, isLoading: isLoadingClinic } = useClinicProfile(clinicId);
  const clinic = clinicData?.clinic;
  const [heroImageBroken, setHeroImageBroken] = useState(false);
  const { data: googlePlaceDetails } = useGooglePlaceDetails(clinic?.googlePlaceId);

  const { data: clinicDoctorsData } = useClinicDoctors(clinicId);
  const clinicDoctors = useMemo(
    () => clinicDoctorsData?.doctors ?? [],
    [clinicDoctorsData?.doctors],
  );

  const doctorsBySpecialization = useMemo(() => {
    return clinicDoctors.reduce<Record<string, typeof clinicDoctors>>((acc, doctor) => {
      if (!acc[doctor.specialization]) {
        acc[doctor.specialization] = [];
      }
      acc[doctor.specialization].push(doctor);
      return acc;
    }, {});
  }, [clinicDoctors]);

  const { data: reviewsData, isLoading: isLoadingReviews } = useQuery<ClinicReviewListResponse>({
    queryKey: ["clinicReviews", clinicId],
    queryFn: async () => {
      const response = await fetch(`/api/clinics/${clinicId}/reviews`);
      if (!response.ok) {
        throw new Error("Unable to load reviews.");
      }
      return (await response.json()) as ClinicReviewListResponse;
    },
    enabled: Boolean(clinicId),
  });

  const reviews = reviewsData?.reviews ?? [];
  const averageRating = reviewsData?.averageRating ?? clinic?.rating ?? 0;
  const ratingAverages = useMemo(() => {
    if (!reviews.length) return null;
    const totals = reviews.reduce(
      (acc, review) => {
        acc.englishCommunication += review.ratings?.englishCommunication ?? review.overallRating ?? 0;
        acc.explainedTreatmentClearly += review.ratings?.explainedTreatmentClearly ?? review.overallRating ?? 0;
        acc.foreignPatientFriendlyStaff += review.ratings?.foreignPatientFriendlyStaff ?? review.overallRating ?? 0;
        acc.cashlessPaymentAvailable += review.ratings?.cashlessPaymentAvailable ?? review.overallRating ?? 0;
        acc.waitTimeReasonable += review.ratings?.waitTimeReasonable ?? review.overallRating ?? 0;
        return acc;
      },
      {
        englishCommunication: 0,
        explainedTreatmentClearly: 0,
        foreignPatientFriendlyStaff: 0,
        cashlessPaymentAvailable: 0,
        waitTimeReasonable: 0,
      },
    );
    return {
      englishCommunication: Number((totals.englishCommunication / reviews.length).toFixed(1)),
      explainedTreatmentClearly: Number((totals.explainedTreatmentClearly / reviews.length).toFixed(1)),
      foreignPatientFriendlyStaff: Number((totals.foreignPatientFriendlyStaff / reviews.length).toFixed(1)),
      cashlessPaymentAvailable: Number((totals.cashlessPaymentAvailable / reviews.length).toFixed(1)),
      waitTimeReasonable: Number((totals.waitTimeReasonable / reviews.length).toFixed(1)),
    };
  }, [reviews]);

  useEffect(() => {
    setHeroImageBroken(false);
  }, [clinic?.id]);

  if (!clinic && isLoadingClinic) {
    return (
      <PageScaffold contentClassName="pb-28 lg:pb-12">
        <LoadingScreen
          title={t("Loading clinic details...")}
          subtitle={t("Fetching clinic profile and reviews.")}
        />
      </PageScaffold>
    );
  }

  if (!clinic) {
    return (
      <PageScaffold contentClassName="pb-28 lg:pb-12">
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <p className="text-lg font-semibold text-[#002D55]">{t("Clinic not found")}</p>
          <button
            type="button"
            onClick={() => navigate("/clinics")}
            className="mt-4 rounded-full bg-[#1648CE] px-5 py-2 text-sm font-semibold text-white"
          >
            {t("Back to clinics")}
          </button>
        </div>
      </PageScaffold>
    );
  }

  const mapsUrl = clinic.googlePlaceId
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        clinic.location,
      )}&query_place_id=${encodeURIComponent(clinic.googlePlaceId)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clinic.location)}`;
  const clinicImageSrc = heroImageBroken
    ? CLINIC_IMAGE_FALLBACK
    : clinic.image?.trim() || CLINIC_IMAGE_FALLBACK;

  return (
    <PageScaffold contentClassName="pb-28 lg:pb-12">
      <header className="relative overflow-hidden bg-white px-4 pt-14 pb-6 shadow-sm lg:px-12 lg:rounded-t-3xl">
        <button
          type="button"
          onClick={() => navigate("/clinics")}
          className="text-sm font-semibold text-[#1648CE] hover:text-[#0F3499]"
        >
          ← {t("Back to clinics")}
        </button>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-[#002D55]">
              <TranslatedText text={clinic.name} />
            </h1>
            <p className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#0089FF]" /> <TranslatedText text={clinic.location} inline />
              </span>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-[#1648CE] hover:text-[#0F3499]"
              >
                {t("Get directions")}
              </a>
            </p>
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
                  <TooltipContent side="bottom" className="max-w-xs text-xs">
                    {t(WOUND_CARE_TOOLTIP)}
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
              {ratingAverages ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">English</span>
                    <span className="font-semibold text-slate-700">{ratingAverages.englishCommunication}/5</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Clear care</span>
                    <span className="font-semibold text-slate-700">{ratingAverages.explainedTreatmentClearly}/5</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Friendly staff</span>
                    <span className="font-semibold text-slate-700">{ratingAverages.foreignPatientFriendlyStaff}/5</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cashless</span>
                    <span className="font-semibold text-slate-700">{ratingAverages.cashlessPaymentAvailable}/5</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Wait time</span>
                    <span className="font-semibold text-slate-700">{ratingAverages.waitTimeReasonable}/5</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Overall</span>
                    <span className="font-semibold text-slate-700">{averageRating.toFixed(1)}/5</span>
                  </span>
                </div>
              ) : (
                <span className="flex items-center gap-1 text-slate-500">
                  {clinic.googlePlaceId ? (
                    <GoogleReviews placeId={clinic.googlePlaceId} fallbackRating={averageRating} />
                  ) : (
                    <>{averageRating.toFixed(1)}/5</>
                  )}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4 text-[#0089FF]" /> {clinic.patients}
              </span>
              <span className="flex items-center gap-1">
                <CalendarClock className="h-4 w-4 text-[#0089FF]" />{" "}
                {formatAvailabilityForLanguage(clinic.nextAvailability, language, t)}
              </span>
            </div>
          </div>
          <div className="overflow-hidden rounded-3xl border border-slate-100 shadow-sm lg:w-[320px]">
            <img
              src={clinicImageSrc}
              alt={clinic.name}
              className="h-48 w-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setHeroImageBroken(true)}
            />
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pt-6 lg:px-12 lg:pt-10">
        <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
          <section className="space-y-8">
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-[#002D55]">{t("Specializations")}</h2>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-[#3A12DB]">
                {clinic.specializations.map((spec) => (
                  <span key={spec} className="rounded-full bg-[#F1EDFF] px-3 py-1">
                    {t(spec)}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-[#002D55]">{t("Doctors by specialization")}</h2>
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
              <div className="mt-6 space-y-6">
                {Object.entries(doctorsBySpecialization).map(([specialization, doctors]) => (
                  <div key={specialization} className="space-y-3">
                    <p className="text-sm font-semibold text-[#002D55]">{t(specialization)}</p>
                    <div className="grid gap-4 md:grid-cols-2">
                      {doctors.map((doctor) => (
                        <div
                          key={doctor.id}
                          className="rounded-2xl border border-slate-100 bg-[#F8FBFF] p-4"
                        >
                          <p className="text-base font-semibold text-[#002D55]">
                            <TranslatedText text={doctor.name} />
                          </p>
                          <p className="text-sm text-slate-500">{doctor.languages.map((language) => t(language)).join(", ")}</p>
                          <p className="text-sm text-slate-500">
                            {t("Next availability")}: {formatAvailabilityForLanguage(doctor.nextAvailable, language, t)}
                          </p>
                          <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-[#B06B00]">
                            <Star className="h-3 w-3" fill="#B06B00" /> {doctor.rating.toFixed(1)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {clinicDoctors.length === 0 && (
                  <p className="text-sm text-slate-500">{t("No doctors listed yet for this clinic.")}</p>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-[#002D55]">{t("Reviews")}</h2>
              <div className="mt-4 space-y-4">
                {isLoadingReviews && (
                  <p className="text-sm text-slate-500">{t("Loading reviews...")}</p>
                )}
                {!isLoadingReviews && reviews.length === 0 && (
                  <p className="text-sm text-slate-500">{t("No reviews yet.")}</p>
                )}
                {reviews.map((review) => {
                  const overall = review.overallRating ?? review.rating ?? 0;
                  const indicators = {
                    englishCommunication: review.ratings?.englishCommunication ?? overall,
                    explainedTreatmentClearly: review.ratings?.explainedTreatmentClearly ?? overall,
                    foreignPatientFriendlyStaff: review.ratings?.foreignPatientFriendlyStaff ?? overall,
                    cashlessPaymentAvailable: review.ratings?.cashlessPaymentAvailable ?? overall,
                    waitTimeReasonable: review.ratings?.waitTimeReasonable ?? overall,
                  };
                  return (
                    <div key={review.id} className="rounded-2xl border border-slate-100 bg-[#F8FBFF] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[#002D55]">{review.author}</p>
                          <p className="text-xs text-slate-500">
                            {new Date(review.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-slate-500">Overall {overall.toFixed(1)}/5</span>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                        <span>
                          <span className="font-semibold text-slate-500">English:</span> {indicators.englishCommunication}/5
                        </span>
                        <span>
                          <span className="font-semibold text-slate-500">Clear care:</span> {indicators.explainedTreatmentClearly}/5
                        </span>
                        <span>
                          <span className="font-semibold text-slate-500">Friendly staff:</span> {indicators.foreignPatientFriendlyStaff}/5
                        </span>
                        <span>
                          <span className="font-semibold text-slate-500">Cashless:</span> {indicators.cashlessPaymentAvailable}/5
                        </span>
                        <span>
                          <span className="font-semibold text-slate-500">Wait time:</span> {indicators.waitTimeReasonable}/5
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-slate-600">{review.comment}</p>
                    </div>
                  );
                })}

                {/* Google Reviews */}
                {googlePlaceDetails?.reviews && googlePlaceDetails.reviews.length > 0 && (
                  <div className="mt-8 border-t border-slate-100 pt-6">
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#002D55]">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z" />
                      </svg>
                      {t("Google Reviews")}
                    </h3>
                    <div className="space-y-4">
                      {googlePlaceDetails.reviews
                        .slice()
                        .sort((a, b) => b.time - a.time)
                        .map((review, i) => (
                        <div key={i} className="rounded-2xl border border-slate-100 bg-white p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              {review.profile_photo_url && (
                                <img
                                  src={review.profile_photo_url}
                                  alt={review.author_name}
                                  className="h-8 w-8 rounded-full"
                                />
                              )}
                              <div>
                                <p className="text-sm font-semibold text-[#002D55]">{review.author_name}</p>
                                <p className="text-xs text-slate-500">{review.relative_time_description}</p>
                              </div>
                            </div>
                            <span className="flex items-center gap-1 text-xs font-semibold text-[#B06B00]">
                              <Star className="h-3 w-3" fill="#B06B00" /> {review.rating}
                            </span>
                          </div>
                          {review.text && <p className="mt-3 text-sm text-slate-600">{review.text}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="space-y-4">
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
