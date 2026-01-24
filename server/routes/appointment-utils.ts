import type { Appointment } from "../types";

type AppointmentCollection = {
  find: (filter: Record<string, unknown>) => {
    toArray: () => Promise<Appointment[]>;
  };
};

export const isOverlappingRange = (startA: Date, endA: Date, startB: Date, endB: Date) =>
  startA < endB && startB < endA;

export const findConfirmedOverlap = async (
  appointments: AppointmentCollection,
  clinicId: string,
  start: Date,
  end: Date,
  excludeId?: unknown,
) => {
  const confirmed = await appointments.find({ clinicId }).toArray();
  return (
    confirmed.find((appointment) => {
      if (excludeId && appointment._id && String(appointment._id) === String(excludeId)) {
        return false;
      }
      if (appointment.status && appointment.status !== "CONFIRMED") {
        return false;
      }
      const confirmedStartValue = appointment.confirmedStart ?? appointment.date;
      if (!confirmedStartValue) return false;
      const confirmedStart = new Date(confirmedStartValue);
      const confirmedEndValue =
        appointment.confirmedEnd ??
        new Date(confirmedStart.getTime() + 30 * 60 * 1000).toISOString();
      const confirmedEnd = new Date(confirmedEndValue);
      if (Number.isNaN(confirmedStart.getTime()) || Number.isNaN(confirmedEnd.getTime())) {
        return false;
      }
      return isOverlappingRange(start, end, confirmedStart, confirmedEnd);
    }) ?? null
  );
};
