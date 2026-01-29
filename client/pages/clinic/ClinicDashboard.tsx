import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Calendar, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getClinicAuthHeader, getClinicSession } from "@/lib/clinic-auth";
import { useClinicProfile } from "@/lib/clinic-data";
import { useTranslation } from "@/lib/i18n";
import { getDateKey, normalizeClinicHours } from "@/lib/scheduling";
import type { AppointmentListResponse, ClinicBookingClosure, ClinicProfileUpdateRequest } from "@shared/api";
import { toast } from "@/components/ui/use-toast";
import { TranslatedText } from "@/components/TranslatedText";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function ClinicDashboard() {
  const session = getClinicSession();
  const { t } = useTranslation();
  const { data: clinicData } = useClinicProfile(session?.clinicId);
  const clinic = clinicData?.clinic;
  const { data: appointmentsData } = useQuery<AppointmentListResponse>({
    queryKey: ["clinic-dashboard-appointments", session?.clinicId],
    queryFn: async () => {
      const response = await fetch("/api/clinic/appointments", {
        headers: {
          ...getClinicAuthHeader(),
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error ?? t("Unable to load appointments."));
      }

      return response.json() as Promise<AppointmentListResponse>;
    },
    enabled: Boolean(session?.clinicId),
  });

  const appointments = appointmentsData?.appointments ?? [];
  const todayKey = getDateKey(new Date());
  const todayAppointments = useMemo(() => {
    return appointments.filter((appointment) => {
      if (
        appointment.status === "CANCELLED_BY_PATIENT" ||
        appointment.status === "CANCELLED_BY_CLINIC" ||
        appointment.status === "DECLINED"
      ) {
        return false;
      }
      const rawDate = appointment.confirmedStart ?? appointment.preferredStart ?? appointment.date;
      const parsed = new Date(rawDate);
      if (!Number.isNaN(parsed.getTime())) {
        return getDateKey(parsed) === todayKey;
      }
      return appointment.dateKey === todayKey;
    });
  }, [appointments, todayKey]);

  const newPatientsThisWeek = useMemo(() => {
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - 6);

    const patientIds = new Set<string>();
    appointments.forEach((appointment) => {
      const parsed = new Date(appointment.date);
      if (Number.isNaN(parsed.getTime())) return;
      if (parsed < weekStart) return;
      const key =
        appointment.patientId ??
        appointment.patientEmail ??
        appointment.patientPhone ??
        appointment.patientName ??
        appointment._id;
      if (key) patientIds.add(key);
    });
    return patientIds.size;
  }, [appointments]);

  const normalizedHours = normalizeClinicHours(clinic?.hours);
  const clinicHours = `${normalizedHours.weekdays.start} - ${normalizedHours.weekdays.end}`;
  const todayStatus =
    clinicData?.clinic?.nextAvailability?.toLowerCase() === "closed for today"
      ? t("Closed for today")
      : t("Clinic hours: {hours}", `Clinic hours: ${clinicHours}`).replace("{hours}", clinicHours);

  const [weekdayStart, setWeekdayStart] = useState(normalizedHours.weekdays.start);
  const [weekdayEnd, setWeekdayEnd] = useState(normalizedHours.weekdays.end);
  const [weekendStart, setWeekendStart] = useState(normalizedHours.weekend.start);
  const [weekendEnd, setWeekendEnd] = useState(normalizedHours.weekend.end);
  const [closedDays, setClosedDays] = useState<string[]>(normalizedHours.closedDays);
  const [bookingClosures, setBookingClosures] = useState<ClinicBookingClosure[]>(clinic?.bookingClosures ?? []);
  const [closureDraft, setClosureDraft] = useState<ClinicBookingClosure>({
    startDate: "",
    endDate: "",
    startTime: "",
    endTime: "",
    reason: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!clinic) return;
    const hours = normalizeClinicHours(clinic.hours);
    setWeekdayStart(hours.weekdays.start);
    setWeekdayEnd(hours.weekdays.end);
    setWeekendStart(hours.weekend.start);
    setWeekendEnd(hours.weekend.end);
    setClosedDays(hours.closedDays);
    setBookingClosures(clinic.bookingClosures ?? []);
  }, [clinic]);

  const handleSaveHours = async () => {
    const clinicId = session?.clinicId;
    if (!clinicId) return;
    const sanitizedClosures = bookingClosures.map((closure) => ({
      ...closure,
      startTime: closure.startTime?.trim() || undefined,
      endTime: closure.endTime?.trim() || undefined,
    }));
    const payload: ClinicProfileUpdateRequest = {
      hours: {
        weekdays: { start: weekdayStart, end: weekdayEnd },
        weekend: { start: weekendStart, end: weekendEnd },
        closedDays,
        slotMinutes: 30,
      },
      bookingClosures: sanitizedClosures,
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
        throw new Error(error?.error ?? t("Unable to update hours."));
      }
      toast({ title: t("Availability updated"), description: t("Patient booking hours were refreshed.") });
    } catch (error) {
      toast({
        title: t("Update failed"),
        description: error instanceof Error ? error.message : t("Please try again."),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const stats = [
    {
      label: t("Appointments today"),
      value: String(todayAppointments.length),
      icon: Calendar,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: t("New patients this week"),
      value: String(newPatientsThisWeek),
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("Dashboard")}</h1>
          <p className="text-gray-500">{t("Here is a quick overview of today.")}</p>
        </div>
        <div className="hidden md:flex items-center gap-3 text-sm text-gray-500">
          <Clock className="h-4 w-4" />
          <span>{todayStatus}</span>
        </div>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</h3>
              </div>
              <div className={`p-3 rounded-lg ${stat.bg}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">{t("Today")}</h2>
            <span className="text-sm text-blue-600">{t("View all")}</span>
          </div>
          <div className="space-y-4">
            {todayAppointments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                {t("No appointments for today yet.")}
              </div>
            ) : (
              todayAppointments.map((item) => {
                const rawDate = item.confirmedStart ?? item.preferredStart ?? item.date;
                const parsed = new Date(rawDate);
                const timeLabel = Number.isNaN(parsed.getTime())
                  ? item.slot
                  : parsed.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
                const statusLabel = item.status === "CONFIRMED" ? t("Confirmed") : t("Pending");
                const statusStyle =
                  item.status === "CONFIRMED" ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700";

                return (
                  <div
                    key={item._id}
                    className="flex items-center justify-between border border-gray-100 rounded-lg p-4"
                  >
                    <div>
                      <p className="text-sm text-gray-500">{timeLabel}</p>
                      <p className="font-semibold text-gray-900">
                        <TranslatedText text={item.patientName ?? t("Patient")} inline />
                      </p>
                      <p className="text-sm text-gray-500">{item.specialization}</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusStyle}`}>
                        {statusLabel}
                      </span>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{t("Availability settings")}</h2>
            <p className="text-sm text-gray-500">{t("Adjust hours, closed days, and booking blocks.")}</p>
          </div>
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700 block">{t("Weekday hours")}</label>
            <div className="flex items-center gap-3">
              <Input type="time" value={weekdayStart} onChange={(event) => setWeekdayStart(event.target.value)} />
              <span className="text-sm text-slate-500">{t("to")}</span>
              <Input type="time" value={weekdayEnd} onChange={(event) => setWeekdayEnd(event.target.value)} />
            </div>
          </div>
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700 block">{t("Weekend hours")}</label>
            <div className="flex items-center gap-3">
              <Input type="time" value={weekendStart} onChange={(event) => setWeekendStart(event.target.value)} />
              <span className="text-sm text-slate-500">{t("to")}</span>
              <Input type="time" value={weekendEnd} onChange={(event) => setWeekendEnd(event.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 block">{t("Closed days")}</label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => {
                const checked = closedDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() =>
                      setClosedDays((prev) => (checked ? prev.filter((item) => item !== day) : [...prev, day]))
                    }
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
            <div className="grid gap-3">
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_1fr_2fr_auto]">
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
            {bookingClosures.length > 0 ? (
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
            ) : (
              <p className="text-sm text-slate-500">{t("No upcoming closures.")}</p>
            )}
          </div>
          <Button onClick={handleSaveHours} disabled={isSaving}>
            {isSaving ? t("Saving...") : t("Save availability")}
          </Button>
        </div>
      </div>
    </div>
  );
}
