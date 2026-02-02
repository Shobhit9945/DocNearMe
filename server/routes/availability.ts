import { Request, Response } from "express";
import { getAppointmentsCollection, getClinicInfoCollection } from "../db";
import {
  applyBookingClosuresToSlots,
  buildSlotsForDate,
  getDateKey,
  isClinicClosedOnDate,
  isSlotInFutureJst,
  normalizeClinicHours,
  parseDateKey,
} from "../lib/scheduling";

export const handleAvailability = async (req: Request, res: Response) => {
  const { date, clinicId } = req.query;

  if (!date) {
    return res.status(400).json({ error: "Date parameter is required" });
  }

  const selectedDate = parseDateKey(date as string);
  if (!selectedDate) {
    return res.status(400).json({ error: "Invalid date parameter" });
  }
  const dateKey = getDateKey(selectedDate);
  const clinicKey = (clinicId as string) || "global";
  const todayKey = getDateKey(new Date());
  let availableSlots: string[] = [];

  if (dateKey < todayKey) {
    return res.json({ date: dateKey, clinicId: clinicKey, slots: [], isClosed: true, reason: "Date has passed." });
  }

  try {
    const clinics = await getClinicInfoCollection();
    const clinic = clinicKey === "global" ? null : await clinics.findOne({ clinicId: clinicKey });
    const hours = normalizeClinicHours(clinic?.hours);
    const closureCheck = isClinicClosedOnDate(selectedDate, hours, clinic?.bookingClosures);

    if (closureCheck.closed) {
      return res.json({ date: dateKey, clinicId: clinicKey, slots: [], isClosed: true, reason: closureCheck.reason });
    }

    availableSlots = buildSlotsForDate(selectedDate, hours);
    const closureSlots = applyBookingClosuresToSlots(selectedDate, availableSlots, clinic?.bookingClosures);
    if (closureSlots.isClosed) {
      return res.json({
        date: dateKey,
        clinicId: clinicKey,
        slots: [],
        isClosed: true,
        reason: closureSlots.reason || "Clinic closed",
      });
    }
    availableSlots = closureSlots.slots;

    const appointments = await getAppointmentsCollection();
    const bookedAppointments = await appointments
      .find({ dateKey, clinicId: clinicKey })
      .project({ slot: 1, status: 1, _id: 0 })
      .toArray();

    const bookedSlots = new Set(
      bookedAppointments
        .filter((appt) => !appt.status || appt.status === "CONFIRMED")
        .map((appt) => appt.slot),
    );
    availableSlots = availableSlots.filter((slot) => !bookedSlots.has(slot));

    if (dateKey === todayKey) {
      availableSlots = availableSlots.filter((slot) => isSlotInFutureJst(dateKey, slot));
    }

    res.json({ date: dateKey, clinicId: clinicKey, slots: availableSlots, isClosed: false });
  } catch (error) {
    console.error("Availability error", error);
    res.status(500).json({ error: "Failed to load availability" });
  }
};
