import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BottomNav } from "@/components/BottomNav";
import { PageScaffold } from "@/components/PageScaffold";
import { DocDaisyBanner } from "@/components/DocDaisyBanner";
import { useClinicDoctors, useClinicProfile } from "@/lib/clinic-data";
import { useTranslation } from "@/lib/i18n";
import { GoogleReviews } from "@/components/GoogleReviews";
import { useGooglePlaceDetails } from "@/hooks/useGooglePlaceDetails";
import { CalendarClock, MapPin, Pencil, Star, Trash, Users } from "lucide-react";
import type {
  ClinicReview,
  ClinicReviewCreateRequest,
  ClinicReviewCreateResponse,
  ClinicReviewDeleteResponse,
  ClinicReviewListResponse,
  ClinicReviewUpdateRequest,
  ClinicReviewUpdateResponse,
} from "@shared/api";

const emptyReviewForm = {
  author: "",
  rating: 5,
  comment: "",
};

export default function ClinicDetail() {
  const { clinicId } = useParams<{ clinicId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: clinicData } = useClinicProfile(clinicId);
  const clinic = clinicData?.clinic;
  const { data: googlePlaceDetails } = useGooglePlaceDetails(clinic?.googlePlaceId);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState(emptyReviewForm);
  const [formError, setFormError] = useState("");

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

  const createReviewMutation = useMutation<ClinicReviewCreateResponse, Error, ClinicReviewCreateRequest>({
    mutationFn: async (payload) => {
      const response = await fetch(`/api/clinics/${clinicId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error("Unable to save review.");
      }
      return (await response.json()) as ClinicReviewCreateResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinicReviews", clinicId] });
    },
  });

  const updateReviewMutation = useMutation<ClinicReviewUpdateResponse, Error, ClinicReviewUpdateRequest>({
    mutationFn: async (payload) => {
      const response = await fetch(`/api/clinics/${clinicId}/reviews/${editingReviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error("Unable to update review.");
      }
      return (await response.json()) as ClinicReviewUpdateResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinicReviews", clinicId] });
    },
  });

  const deleteReviewMutation = useMutation<ClinicReviewDeleteResponse, Error, string>({
    mutationFn: async (reviewId) => {
      const response = await fetch(`/api/clinics/${clinicId}/reviews/${reviewId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Unable to delete review.");
      }
      return (await response.json()) as ClinicReviewDeleteResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinicReviews", clinicId] });
    },
  });

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

  const reviews = reviewsData?.reviews ?? [];
  const averageRating = reviewsData?.averageRating ?? clinic.rating;

  const handleReviewSubmit = async () => {
    setFormError("");
    if (!reviewForm.author.trim() || !reviewForm.comment.trim()) {
      setFormError("Please fill in your name and review.");
      return;
    }

    const payload = {
      author: reviewForm.author.trim(),
      rating: Number(reviewForm.rating),
      comment: reviewForm.comment.trim(),
    };

    try {
      if (editingReviewId) {
        await updateReviewMutation.mutateAsync(payload);
      } else {
        await createReviewMutation.mutateAsync(payload);
      }
      setReviewForm(emptyReviewForm);
      setEditingReviewId(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save review.");
    }
  };

  const startEditingReview = (review: ClinicReview) => {
    setEditingReviewId(review.id);
    setReviewForm({
      author: review.author,
      rating: review.rating,
      comment: review.comment,
    });
  };

  const cancelEditing = () => {
    setEditingReviewId(null);
    setReviewForm(emptyReviewForm);
    setFormError("");
  };

  const handleDeleteReview = async (reviewId: string) => {
    setFormError("");
    if (!window.confirm(t("Delete this review?"))) {
      return;
    }
    try {
      await deleteReviewMutation.mutateAsync(reviewId);
      if (editingReviewId === reviewId) {
        cancelEditing();
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to delete review.");
    }
  };

  return (
    <PageScaffold contentClassName="pb-28 lg:pb-12">
      <header className="relative overflow-hidden bg-white px-4 pt-10 pb-6 shadow-sm lg:px-12 lg:rounded-t-3xl">
        <button
          type="button"
          onClick={() => navigate("/clinics")}
          className="text-sm font-semibold text-[#1648CE] hover:text-[#0F3499]"
        >
          ← {t("Back to clinics")}
        </button>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-[#002D55]">{t(clinic.name)}</h1>
            <p className="flex items-center gap-2 text-sm text-slate-600">
              <MapPin className="h-4 w-4 text-[#0089FF]" /> {clinic.location}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
              <span className="flex items-center gap-1 text-[#B06B00]">
                {clinic.googlePlaceId ? (
                   <GoogleReviews placeId={clinic.googlePlaceId} fallbackRating={averageRating} />
                ) : (
                   <><Star className="h-4 w-4 text-[#B06B00]" fill="#B06B00" /> {averageRating.toFixed(1)}</>
                )}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4 text-[#0089FF]" /> {clinic.patients}
              </span>
              <span className="flex items-center gap-1">
                <CalendarClock className="h-4 w-4 text-[#0089FF]" /> {clinic.nextAvailability}
              </span>
            </div>
          </div>
          <div className="overflow-hidden rounded-3xl border border-slate-100 shadow-sm lg:w-[320px]">
            <img src={clinic.image} alt={t(clinic.name)} className="h-48 w-full object-cover" />
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
                          <p className="text-base font-semibold text-[#002D55]">{t(doctor.name)}</p>
                          <p className="text-sm text-slate-500">{doctor.languages.map((language) => t(language)).join(", ")}</p>
                          <p className="text-sm text-slate-500">
                            {t("Next availability")}: {doctor.nextAvailable}
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
              <p className="mt-1 text-sm text-slate-500">
                {t("Share your experience and help other patients decide.")}
              </p>
              <div className="mt-4 grid gap-4">
                <label className="text-sm font-semibold text-slate-700">
                  {t("Your name")}
                  <input
                    type="text"
                    value={reviewForm.author}
                    onChange={(event) => setReviewForm((prev) => ({ ...prev, author: event.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-[#0089FF] focus:outline-none"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  {t("Rating")}
                  <input
                    type="number"
                    min={1}
                    max={5}
                    step={0.5}
                    value={reviewForm.rating}
                    onChange={(event) =>
                      setReviewForm((prev) => ({ ...prev, rating: Number(event.target.value) }))
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-[#0089FF] focus:outline-none"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  {t("Review")}
                  <textarea
                    value={reviewForm.comment}
                    onChange={(event) => setReviewForm((prev) => ({ ...prev, comment: event.target.value }))}
                    rows={4}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-[#0089FF] focus:outline-none"
                  />
                </label>
                {formError && <p className="text-sm text-red-500">{formError}</p>}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleReviewSubmit}
                    disabled={createReviewMutation.isPending || updateReviewMutation.isPending}
                    className="rounded-full bg-[#002D55] px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {editingReviewId ? t("Update review") : t("Submit review")}
                  </button>
                  {editingReviewId && (
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600"
                    >
                      {t("Cancel")}
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-8 space-y-4">
                {isLoadingReviews && (
                  <p className="text-sm text-slate-500">{t("Loading reviews...")}</p>
                )}
                {!isLoadingReviews && reviews.length === 0 && (
                  <p className="text-sm text-slate-500">{t("No reviews yet. Be the first to share.")}</p>
                )}
                {reviews.map((review) => (
                  <div key={review.id} className="rounded-2xl border border-slate-100 bg-[#F8FBFF] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#002D55]">{review.author}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="flex items-center gap-1 text-xs font-semibold text-[#B06B00]">
                        <Star className="h-3 w-3" fill="#B06B00" /> {review.rating.toFixed(1)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">{review.comment}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEditingReview(review)}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-white"
                      >
                        <Pencil className="h-3 w-3" /> {t("Edit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteReview(review.id)}
                        disabled={deleteReviewMutation.isPending}
                        className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-500 hover:bg-red-50 disabled:opacity-70"
                      >
                        <Trash className="h-3 w-3" /> {t("Delete")}
                      </button>
                    </div>
                  </div>
                ))}

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
