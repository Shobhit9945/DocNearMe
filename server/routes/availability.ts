import { Request, Response } from "express";
import { getAppointmentsCollection } from "../db";

const ALL_SLOTS = [
  "09:00 AM",
  "09:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "02:00 PM",
  "02:30 PM",
  "03:00 PM",
  "03:30 PM",
  "04:00 PM",
  "04:30 PM",
];

const WEEKEND_SLOTS = ["10:00 AM", "10:30 AM", "11:00 AM", "02:00 PM", "02:30 PM", "03:00 PM"];

export const handleAvailability = async (req: Request, res: Response) => {
  const { date, clinicId } = req.query;

  if (!date) {
    return res.status(400).json({ error: "Date parameter is required" });
  }

  const selectedDate = new Date(date as string);
  const dayOfWeek = selectedDate.getDay();
  const dateKey = selectedDate.toISOString().split("T")[0];
  const clinicKey = (clinicId as string) || "global";

  let availableSlots = [...ALL_SLOTS];

  if (dayOfWeek === 0 || dayOfWeek === 6) {
    availableSlots = availableSlots.filter((slot) => WEEKEND_SLOTS.includes(slot));
  }

  try {
    const appointments = await getAppointmentsCollection();
    const bookedAppointments = await appointments
      .find({ dateKey, clinicId: clinicKey })
      .project({ slot: 1, _id: 0 })
      .toArray();

    const bookedSlots = new Set(bookedAppointments.map((appt) => appt.slot));
    availableSlots = availableSlots.filter((slot) => !bookedSlots.has(slot));

    res.json({ date: dateKey, clinicId: clinicKey, slots: availableSlots });
  } catch (error) {
    console.error("Availability error", error);
    res.status(500).json({ error: "Failed to load availability" });
  }
};
