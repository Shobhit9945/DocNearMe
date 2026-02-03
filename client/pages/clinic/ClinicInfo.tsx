import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { getClinicAuthHeader } from "@/lib/clinic-auth";
import { useTranslation } from "@/lib/i18n";
import { useAddressSearch } from "@/hooks/useAddressSearch";
import { normalizeClinicHours } from "@/lib/scheduling";
import type { ClinicBookingClosure, ClinicProfile, ClinicProfileUpdateRequest } from "@shared/api";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const formatDateJp = (value?: string) => (value ? value.replace(/-/g, "/") : "");

// Manual QA checklist:
// - Update notification email and confirm it persists after refresh.
// - Add closure (single day + range) and ensure bookings are blocked on those dates.
// - Delete closure and confirm availability returns.
// - Confirm notification method list stays disabled except Email.
// - Save each section independently without losing changes in other sections.

export default function ClinicInfo() {
  const { t } = useTranslation();
  const tRef = useRef(t);
  const [clinic, setClinic] = useState<ClinicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [phone, setPhone] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [image, setImage] = useState("");
  const [weekdayStart, setWeekdayStart] = useState("09:00");
  const [weekdayEnd, setWeekdayEnd] = useState("18:00");
  const [weekendStart, setWeekendStart] = useState("10:00");
  const [weekendEnd, setWeekendEnd] = useState("16:00");
  const [closedDays, setClosedDays] = useState<string[]>([]);
  const [bookingClosures, setBookingClosures] = useState<ClinicBookingClosure[]>([]);
  const [showClosureForm, setShowClosureForm] = useState(false);
  const [closureDraft, setClosureDraft] = useState({ startDate: "", endDate: "", reason: "" });
  const [isSavingBasic, setIsSavingBasic] = useState(false);
  const [isSavingHours, setIsSavingHours] = useState(false);
  const [isSavingPhotos, setIsSavingPhotos] = useState(false);
  const [isEditingBasic, setIsEditingBasic] = useState(false);
  const [isEditingHours, setIsEditingHours] = useState(false);
  const [isEditingClosures, setIsEditingClosures] = useState(false);
  const [isEditingPhotos, setIsEditingPhotos] = useState(false);

  const {
    suggestions: locationSuggestions,
    isLoading: isLocationLoading,
    error: locationError,
    fetchPlaceDetails,
  } = useAddressSearch(locationInput);

  const sortedClosures = useMemo(
    () =>
      [...bookingClosures].sort((a, b) =>
        (a.startDate ?? "").localeCompare(b.startDate ?? ""),
      ),
    [bookingClosures],
  );

  const hydrateClinicState = (nextClinic: ClinicProfile) => {
    setClinic(nextClinic);
    setName(nextClinic.name ?? "");
    setLocation(nextClinic.location ?? "");
    setLocationInput(nextClinic.location ?? "");
    setPhone(nextClinic.phone ?? "");
    setNotificationEmail(nextClinic.email ?? "");
    setImage(nextClinic.image ?? "");
    const normalizedHours = normalizeClinicHours(nextClinic.hours);
    setWeekdayStart(normalizedHours.weekdays.start);
    setWeekdayEnd(normalizedHours.weekdays.end);
    setWeekendStart(normalizedHours.weekend.start);
    setWeekendEnd(normalizedHours.weekend.end);
    setClosedDays(normalizedHours.closedDays);
    setBookingClosures(nextClinic.bookingClosures ?? []);
  };

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    const loadClinic = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/clinic/me", {
          headers: {
            ...getClinicAuthHeader(),
          },
        });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error?.error ?? tRef.current("Unable to load clinic info."));
        }
        const payload = (await response.json()) as { clinic: ClinicProfile };
        hydrateClinicState(payload.clinic);
      } catch (error) {
        toast({
          title: tRef.current("Failed to load"),
          description: error instanceof Error ? error.message : tRef.current("Please try again."),
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    void loadClinic();
  }, []);

  const handleBasicSave = async () => {
    const trimmedName = name.trim();
    const trimmedLocation = location.trim() || locationInput.trim();
    const trimmedPhone = phone.trim();
    const trimmedNotificationEmail = notificationEmail.trim();

    setIsSavingBasic(true);
    try {
      const payload: ClinicProfileUpdateRequest = {
        name: trimmedName || undefined,
        location: trimmedLocation || undefined,
        phone: trimmedPhone || undefined,
        email: trimmedNotificationEmail || undefined,
        googlePlaceId: clinic?.googlePlaceId,
        notificationEmailEnabled: true,
        notificationPhoneEnabled: false,
        notificationLineEnabled: false,
      };
      const response = await fetch("/api/clinic/me", {
        method: "PATCH",
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
      const updated = (await response.json()) as { clinic: ClinicProfile };
      setClinic(updated.clinic);
      toast({ title: t("Saved"), description: t("Basic information updated.") });
      setIsEditingBasic(false);
    } catch (error) {
      toast({
        title: t("Save failed"),
        description: error instanceof Error ? error.message : t("Please try again."),
        variant: "destructive",
      });
    } finally {
      setIsSavingBasic(false);
    }
  };

  const handleHoursSave = async () => {
    setIsSavingHours(true);
    try {
      const payload: ClinicProfileUpdateRequest = {
        hours: {
          weekdays: { start: weekdayStart, end: weekdayEnd },
          weekend: { start: weekendStart, end: weekendEnd },
          closedDays,
          slotMinutes: 30,
        },
      };
      const response = await fetch("/api/clinic/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getClinicAuthHeader(),
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error ?? t("Unable to save clinic hours."));
      }
      const updated = (await response.json()) as { clinic: ClinicProfile };
      setClinic(updated.clinic);
      toast({ title: t("Saved"), description: t("Clinic hours updated.") });
      setIsEditingHours(false);
    } catch (error) {
      toast({
        title: t("Save failed"),
        description: error instanceof Error ? error.message : t("Please try again."),
        variant: "destructive",
      });
    } finally {
      setIsSavingHours(false);
    }
  };

  const handleAddClosure = async () => {
    if (!closureDraft.startDate) {
      toast({ title: t("Start date is required"), variant: "destructive" });
      return;
    }
    if (closureDraft.endDate && closureDraft.endDate < closureDraft.startDate) {
      toast({ title: t("End date must be after start date"), variant: "destructive" });
      return;
    }

    try {
      const response = await fetch("/api/clinic/me/closures", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getClinicAuthHeader(),
        },
        body: JSON.stringify({
          startDate: closureDraft.startDate,
          endDate: closureDraft.endDate,
          reason: closureDraft.reason,
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error ?? t("Unable to add closure."));
      }
      const updated = (await response.json()) as { clinic: ClinicProfile };
      setClinic(updated.clinic);
      setShowClosureForm(false);
      setClosureDraft({ startDate: "", endDate: "", reason: "" });
      toast({ title: t("Added"), description: t("Closure added.") });
    } catch (error) {
      toast({
        title: t("Add failed"),
        description: error instanceof Error ? error.message : t("Please try again."),
        variant: "destructive",
      });
    }
  };

  const handleDeleteClosure = async (closureId?: string) => {
    if (!closureId) return;
    try {
      const response = await fetch(`/api/clinic/me/closures/${closureId}`, {
        method: "DELETE",
        headers: {
          ...getClinicAuthHeader(),
        },
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error ?? t("Unable to delete closure."));
      }
      const updated = (await response.json()) as { clinic: ClinicProfile };
      setClinic(updated.clinic);
      toast({ title: t("Deleted"), description: t("Closure removed.") });
    } catch (error) {
      toast({
        title: t("Delete failed"),
        description: error instanceof Error ? error.message : t("Please try again."),
        variant: "destructive",
      });
    }
  };

  const handlePhotosSave = async () => {
    setIsSavingPhotos(true);
    try {
      const payload: ClinicProfileUpdateRequest = {
        image: image.trim() || undefined,
      };
      const response = await fetch("/api/clinic/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getClinicAuthHeader(),
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error ?? t("Unable to save photo."));
      }
      const updated = (await response.json()) as { clinic: ClinicProfile };
      setClinic(updated.clinic);
      toast({ title: t("Saved"), description: t("Photo updated.") });
      setIsEditingPhotos(false);
    } catch (error) {
      toast({
        title: t("Save failed"),
        description: error instanceof Error ? error.message : t("Please try again."),
        variant: "destructive",
      });
    } finally {
      setIsSavingPhotos(false);
    }
  };

  if (isLoading) {
    return (
      <LoadingScreen
        title={t("Loading clinic info")}
        subtitle={t("Preparing your clinic settings.")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">{t("Clinic info")}</h1>
        <p className="text-gray-500 mt-1">
          {t("Everything you need to accept bookings in one place.")}
        </p>
      </header>

      <section className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t("Basic information")}</h2>
          <p className="text-sm text-slate-500 mt-1">{t("Shown to patients.")}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">{t("Clinic name")}</label>
            <Input value={name} onChange={(event) => setName(event.target.value)} disabled={!isEditingBasic} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">{t("Phone")}</label>
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} disabled={!isEditingBasic} />
          </div>
        </div>
        <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">{t("Address")}</label>
                <Input
                  value={locationInput}
                  onChange={(event) => setLocationInput(event.target.value)}
                  disabled={!isEditingBasic}
                  placeholder={t("Start typing address")}
                />
                {isEditingBasic ? (
                  <>
                    {isLocationLoading ? (
                      <p className="mt-2 text-xs text-slate-400">{t("Searching addresses...")}</p>
                    ) : locationError ? (
                      <p className="mt-2 text-xs text-rose-500">{locationError}</p>
                    ) : null}
                    {locationSuggestions.length > 0 ? (
                      <div className="mt-2 rounded-lg border border-slate-200 bg-white shadow-sm">
                        {locationSuggestions.map((suggestion) => (
                          <button
                            key={suggestion.placeId}
                            type="button"
                            onClick={async () => {
                              try {
                                const formatted = await fetchPlaceDetails(suggestion.placeId);
                                setLocation(formatted);
                                setLocationInput(formatted);
                                if (clinic) {
                                  setClinic({ ...clinic, googlePlaceId: suggestion.placeId, location: formatted });
                                }
                              } catch (error) {
                                toast({
                                  title: t("Save failed"),
                                  description:
                                    error instanceof Error ? error.message : t("Please try again."),
                                  variant: "destructive",
                                });
                              }
                            }}
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                          >
                            {suggestion.description}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : null}
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">{t("Notification email")}</label>
          <Input
            value={notificationEmail}
            onChange={(event) => setNotificationEmail(event.target.value)}
            placeholder={t("clinic@example.com")}
            type="email"
            disabled={!isEditingBasic}
          />
          <p className="text-xs text-slate-500 mt-2">
            {t("Booking requests are emailed to this address.")}
          </p>
        </div>
        <div className="flex gap-2">
          {isEditingBasic ? (
            <>
              <Button onClick={handleBasicSave} disabled={isSavingBasic}>
                {isSavingBasic ? t("Saving...") : t("Save")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (clinic) hydrateClinicState(clinic);
                  setIsEditingBasic(false);
                }}
              >
                {t("Cancel")}
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" onClick={() => setIsEditingBasic(true)}>
              {t("Edit")}
            </Button>
          )}
        </div>
      </section>

      <section className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t("Clinic hours")}</h2>
          <p className="text-sm text-slate-500 mt-1">{t("Set reception hours by day.")}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 block">{t("Weekdays")}</label>
            <div className="flex items-center gap-3">
              <Input
                type="time"
                value={weekdayStart}
                onChange={(event) => setWeekdayStart(event.target.value)}
                disabled={!isEditingHours}
              />
              <span className="text-sm text-slate-500">{t("to")}</span>
              <Input
                type="time"
                value={weekdayEnd}
                onChange={(event) => setWeekdayEnd(event.target.value)}
                disabled={!isEditingHours}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 block">{t("Weekend")}</label>
            <div className="flex items-center gap-3">
              <Input
                type="time"
                value={weekendStart}
                onChange={(event) => setWeekendStart(event.target.value)}
                disabled={!isEditingHours}
              />
              <span className="text-sm text-slate-500">{t("to")}</span>
              <Input
                type="time"
                value={weekendEnd}
                onChange={(event) => setWeekendEnd(event.target.value)}
                disabled={!isEditingHours}
              />
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
                  disabled={!isEditingHours}
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
        <div className="flex gap-2">
          {isEditingHours ? (
            <>
              <Button onClick={handleHoursSave} disabled={isSavingHours}>
                {isSavingHours ? t("Saving...") : t("Save")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (clinic) hydrateClinicState(clinic);
                  setIsEditingHours(false);
                }}
              >
                {t("Cancel")}
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" onClick={() => setIsEditingHours(true)}>
              {t("Edit")}
            </Button>
          )}
        </div>
      </section>

      <section className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t("Closures")}</h2>
          <p className="text-sm text-slate-500 mt-1">{t("Full-day closures only.")}</p>
        </div>
        <div className="flex gap-2">
          {isEditingClosures ? (
            <>
              <Button type="button" variant="outline" onClick={() => setShowClosureForm((prev) => !prev)}>
                {t("Add closure")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setIsEditingClosures(false)}>
                {t("Done")}
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" onClick={() => setIsEditingClosures(true)}>
              {t("Edit")}
            </Button>
          )}
        </div>
        {showClosureForm ? (
          <div className="grid gap-3 lg:grid-cols-4">
            <div>
              <label className="text-xs text-slate-500 block mb-1">{t("Start date")}</label>
              <Input
                type="date"
                value={closureDraft.startDate}
                onChange={(event) => setClosureDraft((prev) => ({ ...prev, startDate: event.target.value }))}
                disabled={!isEditingClosures}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">{t("End date (optional)")}</label>
              <Input
                type="date"
                value={closureDraft.endDate}
                onChange={(event) => setClosureDraft((prev) => ({ ...prev, endDate: event.target.value }))}
                disabled={!isEditingClosures}
              />
            </div>
            <div className="lg:col-span-2">
              <label className="text-xs text-slate-500 block mb-1">{t("Reason (optional)")}</label>
              <Input
                value={closureDraft.reason}
                onChange={(event) => setClosureDraft((prev) => ({ ...prev, reason: event.target.value }))}
                placeholder={t("e.g. staff training")}
                disabled={!isEditingClosures}
              />
            </div>
            <div className="lg:col-span-4 flex gap-2">
              <Button type="button" onClick={handleAddClosure} disabled={!isEditingClosures}>
                {t("Add")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowClosureForm(false);
                  setClosureDraft({ startDate: "", endDate: "", reason: "" });
                }}
              >
                {t("Cancel")}
              </Button>
            </div>
          </div>
        ) : null}
        {sortedClosures.length === 0 ? (
          <p className="text-sm text-slate-500">{t("No closures yet.")}</p>
        ) : (
          <div className="space-y-2">
            {sortedClosures.map((closure) => (
              <div
                key={closure.id ?? `${closure.startDate}-${closure.endDate}`}
                className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
              >
                <span>
                  {formatDateJp(closure.startDate)}
                  {closure.endDate && closure.endDate !== closure.startDate
                    ? ` 〜 ${formatDateJp(closure.endDate)}`
                    : ""}
                  {closure.reason ? `（${closure.reason}）` : ""}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleDeleteClosure(closure.id)}
                  disabled={!isEditingClosures}
                >
                  {t("Delete")}
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t("Notifications")}</h2>
          <p className="text-sm text-slate-500 mt-1">
            {t(
              "When a booking request arrives, you will receive an email. Please log in only if confirmation is needed.",
            )}
          </p>
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked disabled className="h-4 w-4 rounded border-slate-300 text-[#3A12DB]" />
            <span>{t("Email (required)")}</span>
            <span className="text-xs text-slate-500">{t("ON")}</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-500">
            <input type="checkbox" disabled className="h-4 w-4 rounded border-slate-200" />
            <span>{t("Phone (automated call)")}</span>
            <span className="text-xs text-slate-400">{t("Coming soon")}</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-500">
            <input type="checkbox" disabled className="h-4 w-4 rounded border-slate-200" />
            <span>{t("LINE Bot")}</span>
            <span className="text-xs text-slate-400">{t("Coming soon")}</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-500">
            <input type="checkbox" disabled className="h-4 w-4 rounded border-slate-200" />
            <span>{t("Dashboard only")}</span>
            <span className="text-xs text-slate-400">{t("Coming soon")}</span>
          </label>
        </div>
      </section>

      <section className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t("Photos")}</h2>
          <p className="text-sm text-slate-500 mt-1">{t("Set the main clinic image.")}</p>
        </div>
        {image ? (
          <img
            src={image}
            alt={t("Clinic image")}
            className="w-full max-w-sm rounded-lg border border-slate-200 object-cover"
          />
        ) : (
          <div className="w-full max-w-sm rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
            {t("Preview appears when an image URL is set.")}
          </div>
        )}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">{t("Image (URL)")}</label>
          <Input
            value={image}
            onChange={(event) => setImage(event.target.value)}
            placeholder={t("https://example.com/clinic.jpg")}
            disabled={!isEditingPhotos}
          />
          <p className="text-xs text-slate-500 mt-2">{t("Paste a URL and save.")}</p>
        </div>
        <div className="flex gap-2">
          {isEditingPhotos ? (
            <>
              <Button onClick={handlePhotosSave} disabled={isSavingPhotos}>
                {isSavingPhotos ? t("Saving...") : t("Save")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (clinic) hydrateClinicState(clinic);
                  setIsEditingPhotos(false);
                }}
              >
                {t("Cancel")}
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" onClick={() => setIsEditingPhotos(true)}>
              {t("Edit")}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
