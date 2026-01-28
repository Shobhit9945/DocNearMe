import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { getClinicAuthHeader, getClinicSession } from "@/lib/clinic-auth";
import { useClinicProfile } from "@/lib/clinic-data";
import { useTranslation } from "@/lib/i18n";
import { getDateKey, normalizeClinicHours } from "@/lib/scheduling";
import type { ClinicBookingClosure, ClinicProfileUpdateRequest } from "@shared/api";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function ClinicInfo() {
  const session = getClinicSession();
  const { t } = useTranslation();
  const clinicId = session?.clinicId;
  const { data } = useClinicProfile(clinicId);
  const clinic = data?.clinic;

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [image, setImage] = useState("");
  const [weekdayStart, setWeekdayStart] = useState("09:00");
  const [weekdayEnd, setWeekdayEnd] = useState("18:00");
  const [weekendStart, setWeekendStart] = useState("10:00");
  const [weekendEnd, setWeekendEnd] = useState("16:00");
  const [closedDays, setClosedDays] = useState<string[]>([]);
  const [bookingClosures, setBookingClosures] = useState<ClinicBookingClosure[]>([]);
  const [closureDraft, setClosureDraft] = useState<ClinicBookingClosure>({
    startDate: "",
    endDate: "",
    startTime: "",
    endTime: "",
    reason: "",
  });
  const [firstVisit, setFirstVisit] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [otherServices, setOtherServices] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!clinic) return;
    setName(clinic.name ?? "");
    setLocation(clinic.location ?? "");
    setPhone(clinic.phone ?? "");
    setImage(clinic.image ?? "");
    const normalizedHours = normalizeClinicHours(clinic.hours);
    setWeekdayStart(normalizedHours.weekdays.start);
    setWeekdayEnd(normalizedHours.weekdays.end);
    setWeekendStart(normalizedHours.weekend.start);
    setWeekendEnd(normalizedHours.weekend.end);
    setClosedDays(normalizedHours.closedDays);
    setBookingClosures(clinic.bookingClosures ?? []);
    setFirstVisit(clinic.pricing?.firstVisit ?? "");
    setFollowUp(clinic.pricing?.followUp ?? "");
    setOtherServices(clinic.pricing?.otherServices ?? "");
    setPhotoUrls((clinic.photos ?? []).map((photo) => photo.url));
  }, [clinic]);

  const normalizedPhotos = useMemo(
    () =>
      photoUrls
        .map((url) => url.trim())
        .filter(Boolean)
        .map((url, index) => ({
          label: `Photo ${index + 1}`,
          url,
        })),
    [photoUrls],
  );

  const handleSave = async () => {
    if (!clinicId) {
      toast({ title: t("Missing clinic session"), variant: "destructive" });
      return;
    }

    const trimmedName = name.trim();
    const trimmedLocation = location.trim();
    const trimmedPhone = phone.trim();
    const trimmedImage = image.trim();
    const trimmedFirstVisit = firstVisit.trim();
    const trimmedFollowUp = followUp.trim();
    const trimmedOtherServices = otherServices.trim();
    const hasPricing = Boolean(trimmedFirstVisit || trimmedFollowUp || trimmedOtherServices);
    if (hasPricing && (!trimmedFirstVisit || !trimmedFollowUp || !trimmedOtherServices)) {
      toast({
        title: t("Complete all pricing fields to save pricing."),
        variant: "destructive",
      });
      return;
    }

    const sanitizedClosures = bookingClosures.map((closure) => ({
      ...closure,
      startTime: closure.startTime?.trim() || undefined,
      endTime: closure.endTime?.trim() || undefined,
    }));

    const payload: ClinicProfileUpdateRequest = {
      name: trimmedName || undefined,
      location: trimmedLocation || undefined,
      phone: trimmedPhone || undefined,
      image: trimmedImage || undefined,
      hours: {
        weekdays: { start: weekdayStart, end: weekdayEnd },
        weekend: { start: weekendStart, end: weekendEnd },
        closedDays,
        slotMinutes: 30,
      },
      bookingClosures: sanitizedClosures,
      pricing: hasPricing
        ? {
            firstVisit: trimmedFirstVisit,
            followUp: trimmedFollowUp,
            otherServices: trimmedOtherServices,
          }
        : undefined,
      photos: normalizedPhotos,
    };

    setIsSaving(true);
    try {
      const response = await fetch(`/api/clinics/${clinicId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getClinicAuthHeader(),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error ?? t("Unable to save clinic info."));
      }

      toast({ title: t("Clinic info updated"), description: t("Changes are now visible to patients.") });
    } catch (error) {
      toast({
        title: t("Save failed"),
        description: error instanceof Error ? error.message : t("Please try again."),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">{t("Clinic info")}</h1>
        <p className="text-gray-500 mt-1">
          {t("Update hours, pricing, and photos in one place.")}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">{t("Basic info")}</h2>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">{t("Clinic name")}</label>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">{t("Address")}</label>
            <Input value={location} onChange={(event) => setLocation(event.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">{t("Phone")}</label>
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">{t("Primary image")}</label>
            <Input
              value={image}
              onChange={(event) => setImage(event.target.value)}
              placeholder={t("https://...")}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              {t("Specializations (from doctors)")}
            </label>
            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {(clinic?.specializations ?? []).length > 0
                ? clinic?.specializations?.join(", ")
                : t("Add doctor profiles to populate specialties.")}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">{t("Next availability")}</label>
            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {clinic?.nextAvailability ?? t("Schedule updates after you set hours and closures.")}
            </div>
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? t("Saving...") : t("Save")}
          </Button>
        </section>

        <section className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">{t("Clinic hours")}</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 block">{t("Weekday hours")}</label>
              <div className="flex items-center gap-3">
                <Input type="time" value={weekdayStart} onChange={(event) => setWeekdayStart(event.target.value)} />
                <span className="text-sm text-slate-500">{t("to")}</span>
                <Input type="time" value={weekdayEnd} onChange={(event) => setWeekdayEnd(event.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 block">{t("Weekend hours")}</label>
              <div className="flex items-center gap-3">
                <Input type="time" value={weekendStart} onChange={(event) => setWeekendStart(event.target.value)} />
                <span className="text-sm text-slate-500">{t("to")}</span>
                <Input type="time" value={weekendEnd} onChange={(event) => setWeekendEnd(event.target.value)} />
              </div>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">{t("Closed days")}</label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => {
                const checked = closedDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      setClosedDays((prev) =>
                        checked ? prev.filter((item) => item !== day) : [...prev, day],
                      );
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      checked
                        ? "bg-[#0089FF] text-white"
                        : "bg-white text-slate-600 border border-slate-200"
                    }`}
                  >
                    {t(day)}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700 block">{t("Booking closures")}</label>
            <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1fr_2fr_auto]">
              <Input
                type="date"
                value={closureDraft.startDate}
                onChange={(event) => setClosureDraft((prev) => ({ ...prev, startDate: event.target.value }))}
              />
              <Input
                type="date"
                value={closureDraft.endDate}
                onChange={(event) => setClosureDraft((prev) => ({ ...prev, endDate: event.target.value }))}
              />
              <Input
                type="time"
                value={closureDraft.startTime ?? ""}
                onChange={(event) => setClosureDraft((prev) => ({ ...prev, startTime: event.target.value }))}
                aria-label={t("Closure start time")}
              />
              <Input
                type="time"
                value={closureDraft.endTime ?? ""}
                onChange={(event) => setClosureDraft((prev) => ({ ...prev, endTime: event.target.value }))}
                aria-label={t("Closure end time")}
              />
              <Input
                value={closureDraft.reason ?? ""}
                onChange={(event) => setClosureDraft((prev) => ({ ...prev, reason: event.target.value }))}
                placeholder={t("Reason (optional)")}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!closureDraft.startDate) return;
                  const endDate = closureDraft.endDate || closureDraft.startDate;
                  const startTime = closureDraft.startTime?.trim() || "";
                  const endTime = closureDraft.endTime?.trim() || "";
                  if ((startTime || endTime) && (!startTime || !endTime)) {
                    toast({
                      title: t("Select both start and end time for a partial closure."),
                      variant: "destructive",
                    });
                    return;
                  }
                  setBookingClosures((prev) => [
                    ...prev,
                    { ...closureDraft, endDate, startTime: startTime || undefined, endTime: endTime || undefined },
                  ]);
                  setClosureDraft({ startDate: "", endDate: "", startTime: "", endTime: "", reason: "" });
                }}
              >
                {t("Add")}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  const today = getDateKey(new Date());
                  setBookingClosures((prev) => [
                    ...prev,
                    { startDate: today, endDate: today, reason: t("Closed today") },
                  ]);
                }}
              >
                {t("Close today")}
              </Button>
            </div>
            {bookingClosures.length === 0 ? (
              <p className="text-sm text-slate-500">{t("No upcoming closures.")}</p>
            ) : (
              <div className="space-y-2">
                {bookingClosures.map((closure, index) => (
                  <div
                    key={`${closure.startDate}-${closure.endDate}-${index}`}
                    className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                  >
                    <span>
                      {closure.startDate}
                      {closure.startTime ? ` ${closure.startTime}` : ""} → {closure.endDate}
                      {closure.endTime ? ` ${closure.endTime}` : ""} {closure.reason ? `(${closure.reason})` : ""}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        setBookingClosures((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
                      }
                    >
                      {t("Remove")}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Button variant="outline" onClick={handleSave} disabled={isSaving}>
            {isSaving ? t("Saving...") : t("Update hours")}
          </Button>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">{t("Pricing")}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">{t("First visit")}</label>
              <Input value={firstVisit} onChange={(event) => setFirstVisit(event.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">{t("Follow-up")}</label>
              <Input value={followUp} onChange={(event) => setFollowUp(event.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">{t("Other services")}</label>
            <textarea
              className="w-full min-h-[90px] rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={otherServices}
              onChange={(event) => setOtherServices(event.target.value)}
            />
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? t("Saving...") : t("Save")}
          </Button>
        </section>

        <section className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">{t("Photos")}</h2>
          <div className="space-y-3">
            {photoUrls.map((url, index) => (
              <div key={`${index}-photo`} className="flex items-center gap-3">
                <Input
                  value={url}
                  onChange={(event) => {
                    const next = [...photoUrls];
                    next[index] = event.target.value;
                    setPhotoUrls(next);
                  }}
                  placeholder={`${t("Photo URL")} ${index + 1}`}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPhotoUrls(photoUrls.filter((_, idx) => idx !== index))}
                >
                  {t("Remove")}
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => setPhotoUrls([...photoUrls, ""])}>
              {t("Add photo URL")}
            </Button>
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? t("Saving...") : t("Save")}
          </Button>
        </section>
      </div>
    </div>
  );
}
