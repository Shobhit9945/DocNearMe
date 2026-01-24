import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { getClinicAuthHeader, getClinicSession } from "@/lib/clinic-auth";
import type { AppointmentListResponse, AppointmentResponseItem } from "@shared/api";

type ActionType = "decline" | "reschedule" | "cancel";

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

const formatAppointmentTime = (appointment: AppointmentResponseItem) => {
  const rawDate = appointment.confirmedStart ?? appointment.preferredStart ?? appointment.date;
  const parsed = new Date(rawDate);
  const dateLabel = Number.isNaN(parsed.getTime())
    ? appointment.date
    : parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${dateLabel} · ${appointment.slot}`;
};

export default function ClinicAppointments() {
  const session = getClinicSession();
  const { data, isLoading, error, refetch } = useQuery<AppointmentListResponse>({
    queryKey: ["clinic-appointments", session?.clinicId],
    queryFn: fetchClinicAppointments,
    enabled: Boolean(session?.clinicId),
  });
  const [actionType, setActionType] = useState<ActionType | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [activeAppointment, setActiveAppointment] = useState<AppointmentResponseItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        throw new Error(errorPayload?.error ?? "Unable to confirm appointment.");
      }

      toast({ title: "Appointment confirmed", description: "The patient has been notified." });
      await refetch();
    } catch (err) {
      toast({
        title: "Confirmation failed",
        description: err instanceof Error ? err.message : "Please try again.",
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
        title: "Message required",
        description: "Please enter a message before sending.",
        variant: "destructive",
      });
      return;
    }

    const endpoint =
      actionType === "decline"
        ? `/api/clinic/appointments/${activeAppointment._id}/decline`
        : actionType === "cancel"
          ? `/api/clinic/appointments/${activeAppointment._id}/cancel`
          : `/api/clinic/appointments/${activeAppointment._id}/reschedule-message`;
    const payload =
      actionType === "decline"
        ? { declineReason: actionMessage.trim() }
        : actionType === "cancel"
          ? { reason: actionMessage.trim() }
          : { message: actionMessage.trim() };

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
        throw new Error(errorPayload?.error ?? "Unable to update appointment.");
      }

      const title =
        actionType === "decline"
          ? "Appointment declined"
          : actionType === "cancel"
            ? "Appointment cancelled"
            : "Reschedule message sent";
      toast({
        title,
        description: "The patient has been notified.",
      });
      await refetch();
      closeDialog();
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
        <p className="text-gray-500 mt-1">
          Review and respond to appointment requests from your patients.
        </p>
      </header>

      {!session?.clinicId ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-sm text-gray-500">
          Sign in to view your clinic appointments.
        </div>
      ) : isLoading ? (
        <div className="rounded-xl border border-gray-100 bg-white p-6 text-sm text-gray-500">
          Loading appointments...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-sm text-red-600">
          Unable to load appointments. Please refresh or try again.
        </div>
      ) : appointments.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white p-6 text-sm text-gray-500">
          No appointment requests yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {appointments.map((appointment) => {
            const statusClass = statusStyles[appointment.status] ?? "bg-gray-100 text-gray-700";
            const statusLabel = statusLabels[appointment.status] ?? appointment.status;
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

            return (
              <div
                key={appointment._id}
                className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <p className="text-sm text-gray-500">{formatAppointmentTime(appointment)}</p>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {appointment.patientName ?? "Patient"}
                    </h2>
                    <p className="text-sm text-gray-500">{appointment.specialization}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Tel: {appointment.patientPhone ?? "Not provided"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusClass}`}>
                      {statusLabel}
                    </span>
                    <Button
                      variant="outline"
                      onClick={() => openDialog("reschedule", appointment)}
                      disabled={!canMessage || isSubmitting}
                    >
                      Reschedule
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => openDialog("cancel", appointment)}
                      disabled={!canCancel || isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => openDialog("decline", appointment)}
                      disabled={!canConfirm || isSubmitting}
                    >
                      Decline
                    </Button>
                    <Button onClick={() => handleConfirm(appointment)} disabled={!canConfirm || isSubmitting}>
                      Confirm
                    </Button>
                  </div>
                </div>
                <div className="mt-4 space-y-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                  <p>
                    Notes: {appointment.notes ? appointment.notes : "No notes provided."}
                  </p>
                  {appointment.clinicMessage ? (
                    <p>
                      Latest clinic message: <span className="font-medium">{appointment.clinicMessage}</span>
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
              {actionType === "decline"
                ? "Decline appointment request"
                : actionType === "cancel"
                  ? "Cancel appointment"
                  : "Request a reschedule"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "decline"
                ? "Share a brief reason for declining this request."
                : actionType === "cancel"
                  ? "Share a brief reason for cancelling this appointment."
                  : "Send a message requesting a new time for this appointment."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={actionMessage}
            onChange={(event) => setActionMessage(event.target.value)}
            placeholder={
              actionType === "decline"
                ? "Let the patient know why the appointment cannot be confirmed."
                : actionType === "cancel"
                  ? "Let the patient know why the appointment is being cancelled."
                  : "Suggest a new time window or ask the patient to submit another request."
            }
            className="min-h-[120px]"
          />
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={closeDialog} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="button" onClick={handleActionSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Send message"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
