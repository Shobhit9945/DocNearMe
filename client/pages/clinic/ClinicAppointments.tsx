import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { getClinicAuthHeader, getClinicSession } from "@/lib/clinic-auth";
import { useTranslation } from "@/lib/i18n";
import { getSpecializationLabel } from "@/lib/specializations";
import { formatSlotForLanguage } from "@/lib/time-format";
import type { AppointmentListResponse, AppointmentResponseItem, ClinicPatientDetailsResponse } from "@shared/api";

type ActionType = "reschedule" | "cancel";

const statusStyles: Record<string, string> = {
  CONFIRMED: "bg-green-50 text-green-700",
  PENDING_CLINIC: "bg-yellow-50 text-yellow-700",
  RESCHEDULE_REQUESTED: "bg-orange-50 text-orange-700",
  DECLINED: "bg-red-50 text-red-700",
  CANCELLED_BY_PATIENT: "bg-slate-100 text-slate-600",
  CANCELLED_BY_CLINIC: "bg-slate-100 text-slate-600",
};

const statusLabels: Record<string, string> = {
  CONFIRMED: "Confirmed",
  PENDING_CLINIC: "Pending confirmation",
  RESCHEDULE_REQUESTED: "Reschedule requested",
  DECLINED: "Declined",
  CANCELLED_BY_PATIENT: "Cancelled",
  CANCELLED_BY_CLINIC: "Cancelled by clinic",
};

const fetchClinicAppointments = async (): Promise<AppointmentListResponse> => {
  const response = await fetch("/api/clinic/appointments", {
    headers: {
      ...getClinicAuthHeader(),
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error ?? "Unable to load appointments.");
  }

  return response.json() as Promise<AppointmentListResponse>;
};

const formatAppointmentTime = (appointment: AppointmentResponseItem, language: string) => {
  const rawDate = appointment.confirmedStart ?? appointment.preferredStart ?? appointment.date;
  const parsed = new Date(rawDate);
  const locale = language === "ja" ? "ja-JP" : undefined;
  const dateLabel = Number.isNaN(parsed.getTime())
    ? appointment.date
    : parsed.toLocaleDateString(locale, { month: "short", day: "numeric" });
  const slotLabel = formatSlotForLanguage(appointment.slot, language);
  return `${dateLabel} · ${slotLabel}`;
};

export default function ClinicAppointments() {
  const session = getClinicSession();
  const { t, language } = useTranslation();
  const { data, isLoading, error, refetch } = useQuery<AppointmentListResponse>({
    queryKey: ["clinic-appointments", session?.clinicId],
    queryFn: fetchClinicAppointments,
    enabled: Boolean(session?.clinicId),
  });
  const [actionType, setActionType] = useState<ActionType | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [activeAppointment, setActiveAppointment] = useState<AppointmentResponseItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [patientDetails, setPatientDetails] = useState<ClinicPatientDetailsResponse | null>(null);
  const [patientDetailsOpen, setPatientDetailsOpen] = useState(false);
  const [patientDetailsLoading, setPatientDetailsLoading] = useState(false);
  const [patientDetailsError, setPatientDetailsError] = useState<string | null>(null);
  const [patientDetailsAppointmentId, setPatientDetailsAppointmentId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AppointmentResponseItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const appointments = useMemo(() => data?.appointments ?? [], [data?.appointments]);
  const dialogOpen = Boolean(actionType && activeAppointment);
  const resolveTranslatedPair = (
    value: string | undefined,
    translated: string | undefined,
    fallback: string,
  ) => {
    const primaryFallback = value ?? translated ?? fallback;
    if (
      language === "ja" &&
      translated &&
      translated.trim().length > 0 &&
      value &&
      translated !== value
    ) {
      return { primary: translated, secondary: value };
    }
    return { primary: primaryFallback, secondary: null };
  };

  const openDialog = (type: ActionType, appointment: AppointmentResponseItem) => {
    setActionType(type);
    setActionMessage("");
    setActiveAppointment(appointment);
  };

  const closeDialog = () => {
    setActionType(null);
    setActionMessage("");
    setActiveAppointment(null);
  };

  const openDeleteDialog = (appointment: AppointmentResponseItem) => {
    setDeleteTarget(appointment);
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setDeleteTarget(null);
    setDeleteDialogOpen(false);
  };

  const handleConfirm = async (appointment: AppointmentResponseItem) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/clinic/appointments/${appointment._id}/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getClinicAuthHeader(),
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error ?? t("Unable to confirm appointment."));
      }

      toast({ title: t("Appointment confirmed"), description: t("The patient has been notified.") });
      await refetch();
    } catch (err) {
      toast({
        title: t("Confirmation failed"),
        description: err instanceof Error ? err.message : t("Please try again."),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActionSubmit = async () => {
    if (!actionType || !activeAppointment) return;
    if (!actionMessage.trim()) {
      toast({
        title: t("Message required"),
        description: t("Please enter a message before sending."),
        variant: "destructive",
      });
      return;
    }

    const endpoint =
      actionType === "cancel"
        ? `/api/clinic/appointments/${activeAppointment._id}/cancel`
        : `/api/clinic/appointments/${activeAppointment._id}/reschedule-message`;
    const payload =
      actionType === "cancel" ? { reason: actionMessage.trim() } : { message: actionMessage.trim() };

    setIsSubmitting(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getClinicAuthHeader(),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error ?? t("Unable to update appointment."));
      }

      const title =
        actionType === "cancel" ? t("Appointment cancelled") : t("Reschedule message sent");
      toast({
        title,
        description: t("The patient has been notified."),
      });
      await refetch();
      closeDialog();
    } catch (err) {
      toast({
        title: t("Update failed"),
        description: err instanceof Error ? err.message : t("Please try again."),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAppointment = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/clinic/appointments/${deleteTarget._id}`, {
        method: "DELETE",
        headers: {
          ...getClinicAuthHeader(),
        },
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error ?? t("Unable to delete appointment."));
      }

      toast({
        title: t("Appointment deleted"),
        description: t("The appointment record has been removed."),
      });
      await refetch();
      closeDeleteDialog();
    } catch (err) {
      toast({
        title: t("Delete failed"),
        description: err instanceof Error ? err.message : t("Please try again."),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewPatientDetails = async (appointment: AppointmentResponseItem) => {
    setPatientDetailsOpen(true);
    setPatientDetails(null);
    setPatientDetailsError(null);
    setPatientDetailsLoading(true);
    setPatientDetailsAppointmentId(appointment._id);
    try {
      const response = await fetch(`/api/clinic/appointments/${appointment._id}/patient`, {
        headers: {
          ...getClinicAuthHeader(),
        },
      });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error ?? t("Unable to load patient details."));
      }
      const data = (await response.json()) as ClinicPatientDetailsResponse;
      setPatientDetails(data);
    } catch (err) {
      setPatientDetailsError(err instanceof Error ? err.message : t("Unable to load patient details."));
    } finally {
      setPatientDetailsLoading(false);
    }
  };

  const handleDownloadSharedRecord = async (record: ClinicPatientDetailsResponse["sharedRecord"]) => {
    if (!record) return;
    let recordData = record.data;
    if (!recordData && patientDetailsAppointmentId) {
      try {
        const response = await fetch(
          `/api/clinic/appointments/${patientDetailsAppointmentId}/patient?includeRecordData=true`,
          {
            headers: {
              ...getClinicAuthHeader(),
            },
          },
        );
        if (!response.ok) {
          const errorPayload = await response.json().catch(() => ({}));
          throw new Error(errorPayload?.error ?? t("Unable to load the shared document."));
        }
        const data = (await response.json()) as ClinicPatientDetailsResponse;
        recordData = data.sharedRecord?.data;
      } catch (error) {
        toast({
          title: t("Download failed"),
          description: error instanceof Error ? error.message : t("Unable to load the shared document."),
          variant: "destructive",
        });
        return;
      }
    }

    if (!recordData) {
      toast({
        title: t("Download failed"),
        description: t("Shared document data is unavailable."),
        variant: "destructive",
      });
      return;
    }

    const byteCharacters = atob(recordData);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i += 1) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: record.type });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = record.name;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">{t("Appointments")}</h1>
        <p className="text-gray-500 mt-1">
          {t("Review and respond to appointment requests from your patients.")}
        </p>
      </header>

      {!session?.clinicId ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-sm text-gray-500">
          {t("Sign in to view your clinic appointments.")}
        </div>
      ) : isLoading ? (
        <div className="rounded-xl border border-gray-100 bg-white p-6 text-sm text-gray-500">
          {t("Loading appointments...")}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-sm text-red-600">
          {t("Unable to load appointments. Please refresh or try again.")}
        </div>
      ) : appointments.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white p-6 text-sm text-gray-500">
          {t("No appointment requests yet.")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {appointments.map((appointment) => {
            const statusClass = statusStyles[appointment.status] ?? "bg-gray-100 text-gray-700";
            const statusLabel = t(statusLabels[appointment.status] ?? appointment.status);
            const canConfirm =
              appointment.status === "PENDING_CLINIC" || appointment.status === "RESCHEDULE_REQUESTED";
            const canMessage =
              appointment.status !== "DECLINED" &&
              appointment.status !== "CANCELLED_BY_PATIENT" &&
              appointment.status !== "CANCELLED_BY_CLINIC";
            const canCancel =
              appointment.status !== "DECLINED" &&
              appointment.status !== "CANCELLED_BY_PATIENT" &&
              appointment.status !== "CANCELLED_BY_CLINIC";
            const { primary: patientNamePrimary, secondary: patientNameSecondary } = resolveTranslatedPair(
              appointment.patientName,
              appointment.patientNameTranslated,
              t("Patient"),
            );
            const { primary: notesPrimary, secondary: notesSecondary } = resolveTranslatedPair(
              appointment.notes,
              appointment.notesTranslated,
              t("No notes provided."),
            );
            const specializationLabel = t(getSpecializationLabel(appointment.specialization));

            const actionButtonClass = "w-full sm:w-auto whitespace-normal text-center h-auto py-2 leading-tight";

            return (
              <div
                key={appointment._id}
                className="relative bg-white border border-gray-100 rounded-xl p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500">{formatAppointmentTime(appointment, language)}</p>
                    <h2 className="text-lg font-semibold text-gray-900">{patientNamePrimary}</h2>
                    {patientNameSecondary ? (
                      <p className="text-xs text-gray-400">
                        {t("Original")}: {patientNameSecondary}
                      </p>
                    ) : null}
                    <p className="text-sm text-gray-500">{specializationLabel}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {t("Tel")}: {appointment.patientPhone ?? t("Not provided")}
                    </p>
                    <p className="text-sm text-gray-500">
                      {t("Visa type")}: {appointment.patientVisaType ?? t("Not provided")}
                    </p>
                  </div>
                  <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end sm:gap-3">
                    <span className={`col-span-2 w-fit px-3 py-1 rounded-full text-xs font-medium ${statusClass}`}>
                      {statusLabel}
                    </span>
                    <Button
                      variant="outline"
                      onClick={() => handleViewPatientDetails(appointment)}
                      className={actionButtonClass}
                    >
                      {t("View patient details")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => openDialog("reschedule", appointment)}
                      disabled={!canMessage || isSubmitting}
                      className={actionButtonClass}
                    >
                      {t("Request a reschedule")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => openDialog("cancel", appointment)}
                      disabled={!canCancel || isSubmitting}
                      className={actionButtonClass}
                    >
                      {t("Cancel appointment")}
                    </Button>
                    <Button
                      onClick={() => handleConfirm(appointment)}
                      disabled={!canConfirm || isSubmitting}
                      className={actionButtonClass}
                    >
                      {t("Confirm appointment")}
                    </Button>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-3 top-3 text-slate-400 hover:text-red-500"
                  onClick={() => openDeleteDialog(appointment)}
                  disabled={isSubmitting || isDeleting}
                  aria-label={t("Delete appointment record")}
                  title={t("Delete appointment record")}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <div className="mt-4 space-y-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                  <p>{t("Notes")}: {notesPrimary}</p>
                  {notesSecondary ? (
                    <p className="text-xs text-gray-400">
                      {t("Original")}: {notesSecondary}
                    </p>
                  ) : null}
                  {appointment.clinicMessage ? (
                    <p>
                      {t("Latest clinic message")}:{" "}
                      <span className="font-medium">{appointment.clinicMessage}</span>
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? null : closeDialog())}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {actionType === "cancel" ? t("Cancel appointment") : t("Request a reschedule")}
            </DialogTitle>
            <DialogDescription>
              {actionType === "cancel"
                ? t("Share a brief reason for cancelling this appointment.")
                : t("Send a message requesting a new time for this appointment.")}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={actionMessage}
            onChange={(event) => setActionMessage(event.target.value)}
            placeholder={
              actionType === "cancel"
                ? t("Let the patient know why the appointment is being cancelled.")
                : t("Suggest a new time window or ask the patient to submit another request.")
            }
            className="min-h-[120px]"
          />
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={closeDialog} disabled={isSubmitting}>
              {t("Cancel")}
            </Button>
            <Button type="button" onClick={handleActionSubmit} disabled={isSubmitting}>
              {isSubmitting ? t("Sending...") : t("Send message")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={(open) => (open ? null : closeDeleteDialog())}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Delete appointment record?")}</DialogTitle>
            <DialogDescription>
              {t("This will permanently remove the appointment from your clinic records.")}
            </DialogDescription>
          </DialogHeader>
          {deleteTarget ? (
            <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              {(() => {
                const { primary, secondary } = resolveTranslatedPair(
                  deleteTarget.patientName,
                  deleteTarget.patientNameTranslated,
                  t("Patient"),
                );
                return (
                  <div className="space-y-1">
                    <p className="font-medium text-slate-800">{primary}</p>
                    {secondary ? (
                      <p className="text-xs text-slate-400">
                        {t("Original")}: {secondary}
                      </p>
                    ) : null}
                  </div>
                );
              })()}
              <p>{formatAppointmentTime(deleteTarget, language)}</p>
            </div>
          ) : null}
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={closeDeleteDialog} disabled={isDeleting}>
              {t("Keep record")}
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteAppointment} disabled={isDeleting}>
              {isDeleting ? t("Deleting...") : t("Delete appointment record")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Dialog
        open={patientDetailsOpen}
        onOpenChange={(open) => {
          setPatientDetailsOpen(open);
          if (!open) {
            setPatientDetailsAppointmentId(null);
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("Patient details")}</DialogTitle>
            <DialogDescription>{t("Review patient information and shared documents.")}</DialogDescription>
          </DialogHeader>
          {patientDetailsLoading ? (
            <p className="text-sm text-slate-500">{t("Loading patient details...")}</p>
          ) : patientDetailsError ? (
            <p className="text-sm text-red-500">{patientDetailsError}</p>
          ) : patientDetails ? (
            <div className="space-y-4 text-sm text-slate-700">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{t("Name")}</p>
                  {(() => {
                    const { primary, secondary } = resolveTranslatedPair(
                      patientDetails.patient.name,
                      patientDetails.patient.nameTranslated,
                      t("Not provided"),
                    );
                    return (
                      <div className="space-y-1">
                        <p className="font-medium">{primary}</p>
                        {secondary ? (
                          <p className="text-xs text-slate-400">
                            {t("Original")}: {secondary}
                          </p>
                        ) : null}
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{t("Age")}</p>
                  <p className="font-medium">
                    {patientDetails.patient.age !== undefined && patientDetails.patient.age !== null
                      ? patientDetails.patient.age
                      : t("Not provided")}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{t("Country")}</p>
                  <p className="font-medium">{patientDetails.patient.country || t("Not provided")}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{t("Visa type")}</p>
                  <p className="font-medium">{patientDetails.patient.visaType || t("Not provided")}</p>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">{t("Shared medical document")}</p>
                {patientDetails.sharedRecord ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{patientDetails.sharedRecord.name}</p>
                      <p className="text-xs text-slate-500">
                        {patientDetails.sharedRecord.type} ·{" "}
                        {Math.round(patientDetails.sharedRecord.size / 1024)} KB
                      </p>
                    </div>
                    <Button type="button" variant="outline" onClick={() => handleDownloadSharedRecord(patientDetails.sharedRecord)}>
                      {t("Download document")}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">{t("No document shared.")}</p>
                )}
              </div>
            </div>
          ) : null}
          <DialogFooter className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => setPatientDetailsOpen(false)}>
              {t("Close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
