import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { clearClinicSession, getClinicAuthHeader, getClinicSession } from "@/lib/clinic-auth";
import { useTranslation } from "@/lib/i18n";
import { getSpecializationLabel } from "@/lib/specializations";
import { formatSlotForLanguage } from "@/lib/time-format";
import { TranslatedText } from "@/components/TranslatedText";
import { TranslatedDocumentViewer } from "@/components/TranslatedDocumentViewer";
import { LoadingScreen } from "@/components/LoadingScreen";
import type {
  AppointmentListResponse,
  AppointmentResponseItem,
  ClinicPatientDetailsResponse,
  IntakeAnswerValue,
} from "@shared/api";

type ActionType = "reschedule" | "cancel";

const statusStyles: Record<string, string> = {
  CONFIRMED: "bg-green-50 text-green-700",
  PENDING_CLINIC: "bg-yellow-50 text-yellow-700",
  RESCHEDULE_REQUESTED: "bg-orange-50 text-orange-700",
  DECLINED: "bg-red-50 text-red-700",
  CANCELLED_BY_PATIENT: "bg-slate-100 text-slate-600",
  CANCELLED_BY_CLINIC: "bg-slate-100 text-slate-600",
  COMPLETED: "bg-blue-50 text-blue-700",
  NO_SHOW: "bg-slate-100 text-slate-600",
};

const statusLabels: Record<string, string> = {
  CONFIRMED: "Confirmed",
  PENDING_CLINIC: "Pending confirmation",
  RESCHEDULE_REQUESTED: "Reschedule requested",
  DECLINED: "Declined",
  CANCELLED_BY_PATIENT: "Cancelled",
  CANCELLED_BY_CLINIC: "Cancelled by clinic",
  COMPLETED: "Visit completed",
  NO_SHOW: "No show",
};

const fetchClinicAppointments = async (): Promise<AppointmentListResponse> => {
  const response = await fetch("/api/clinic/appointments", {
    headers: {
      ...getClinicAuthHeader(),
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const detail = typeof error?.detail === "string" ? error.detail : "";
    if (
      response.status === 401 &&
      (detail === "invalid_token" || detail === "missing_token" || detail === "user_not_found")
    ) {
      clearClinicSession();
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
      throw new Error("Session expired. Please sign in again.");
    }
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

const formatIntakeValue = (
  value: IntakeAnswerValue,
  t: (key: string, fallback?: string) => string,
) => {
  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : t("Not provided");
  }
  if (typeof value === "boolean") {
    return value ? t("Yes") : t("No");
  }
  if (typeof value === "number") {
    return Number.isNaN(value) ? t("Not provided") : String(value);
  }
  if (typeof value === "string") {
    return value.trim() ? value : t("Not provided");
  }
  return t("Not provided");
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

  const handleComplete = async (appointment: AppointmentResponseItem) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/clinic/appointments/${appointment._id}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getClinicAuthHeader(),
        },
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error ?? t("Unable to complete appointment."));
      }

      toast({ title: t("Visit completed"), description: t("The patient can now leave a review.") });
      await refetch();
    } catch (err) {
      toast({
        title: t("Completion failed"),
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
        <LoadingScreen
          title={t("Loading appointments...")}
          subtitle={t("Fetching the latest requests.")}
        />
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
            const specializationLabel = t(getSpecializationLabel(appointment.specialization));
            const canComplete = appointment.status === "CONFIRMED";

            const actionButtonClass = "w-full sm:w-auto whitespace-normal text-center h-auto py-2 leading-tight";

            return (
              <div
                key={appointment._id}
                className="relative bg-white border border-gray-100 rounded-xl p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500">{formatAppointmentTime(appointment, language)}</p>
                    <h2 className="text-lg font-semibold text-gray-900">
                      <TranslatedText
                        text={appointment.patientName ?? t("Patient")}
                        translatedText={appointment.patientNameTranslated}
                        showOriginal
                      />
                    </h2>
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
                    <Button
                      variant="outline"
                      onClick={() => handleComplete(appointment)}
                      disabled={!canComplete || isSubmitting}
                      className={actionButtonClass}
                    >
                      {t("Mark visit complete")}
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
                  <p>
                    {t("Notes")}:{" "}
                    <TranslatedText
                      text={appointment.notes ?? t("No notes provided.")}
                      translatedText={appointment.notesTranslated}
                      inline
                      showOriginal
                    />
                  </p>
                  {appointment.clinicMessage ? (
                    <p>
                      {t("Latest clinic message")}:{" "}
                      <span className="font-medium">
                        <TranslatedText text={appointment.clinicMessage} inline />
                      </span>
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
              <div className="space-y-1">
                <p className="font-medium text-slate-800">
                  <TranslatedText
                    text={deleteTarget.patientName ?? t("Patient")}
                    translatedText={deleteTarget.patientNameTranslated}
                    showOriginal
                  />
                </p>
              </div>
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
                  <div className="space-y-1">
                    <p className="font-medium">
                      <TranslatedText
                        text={patientDetails.patient.name ?? t("Not provided")}
                        translatedText={patientDetails.patient.nameTranslated}
                        showOriginal
                      />
                    </p>
                  </div>
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
                  <p className="font-medium">
                    <TranslatedText
                      text={patientDetails.patient.country || t("Not provided")}
                      inline
                    />
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{t("Visa type")}</p>
                  <p className="font-medium">
                    <TranslatedText
                      text={patientDetails.patient.visaType || t("Not provided")}
                      inline
                    />
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">{t("Shared medical document")}</p>
                {patientDetails.sharedRecord ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">
                          <TranslatedText text={patientDetails.sharedRecord.name} inline />
                        </p>
                        <p className="text-xs text-slate-500">
                          {patientDetails.sharedRecord.type} ·{" "}
                          {Math.round(patientDetails.sharedRecord.size / 1024)} KB
                        </p>
                      </div>
                      <Button type="button" variant="outline" onClick={() => handleDownloadSharedRecord(patientDetails.sharedRecord)}>
                        {t("Download document")}
                      </Button>
                    </div>
                    {patientDetailsAppointmentId && (
                      <TranslatedDocumentViewer
                        record={patientDetails.sharedRecord}
                        appointmentId={patientDetailsAppointmentId}
                      />
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-500">{t("No document shared.")}</p>
                )}
              </div>
              {patientDetails.intakeResponse ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{t("Intake form responses")}</p>
                    {patientDetails.intakeResponse.submittedAt ? (
                      <span className="text-xs text-slate-400">
                        {new Date(patientDetails.intakeResponse.submittedAt).toLocaleDateString()}
                      </span>
                    ) : null}
                  </div>
                  {patientDetails.intakeResponse.responses.length > 0 ? (
                    <div className="space-y-2">
                      {patientDetails.intakeResponse.responses.map((response) => (
                        <div key={response.questionId} className="text-sm text-slate-700">
                          <p className="font-medium text-slate-800">
                            <TranslatedText text={response.label} inline />
                          </p>
                          <p>
                            <TranslatedText
                              text={formatIntakeValue(response.value, t)}
                              inline
                              targetLanguage="ja"
                            />
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">{t("No intake responses submitted.")}</p>
                  )}
                </div>
              ) : null}
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
