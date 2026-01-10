import { Request, Response } from "express";
import { Appointment } from "../types";

const appointments: Appointment[] = [];

const generateBookingId = () =>
  `DNM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

export const handleCreateAppointment = async (req: Request, res: Response) => {
  const { date, slot, specialization, clinicId, notes, patientName, patientEmail } = req.body;

  if (!date || !slot || !specialization) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const clinicKey = clinicId || "global";

  const dateObj = new Date(date);
  const dateKey = dateObj.toISOString().split("T")[0];

  const existing = appointments.find(
    (appointment) => appointment.dateKey === dateKey && appointment.slot === slot && appointment.clinicId === clinicKey
  );
  if (existing) {
    return res.status(409).json({ error: "Slot already booked" });
  }

  const record: Appointment = {
    date: dateObj.toISOString(),
    dateKey,
    slot,
    specialization,
    clinicId: clinicKey,
    notes,
    patientName: patientName?.trim() || undefined,
    patientEmail: patientEmail?.trim() || undefined,
    createdAt: new Date(),
  };

  appointments.push(record);

  res.status(201).json({
    success: true,
    id: generateBookingId(),
    message: "Appointment booked successfully",
  });
};

export const handleListAppointments = async (_req: Request, res: Response) => {
  const sorted = [...appointments].sort((a, b) => {
    if (a.date === b.date) {
      return a.slot.localeCompare(b.slot);
    }
    return a.date.localeCompare(b.date);
  });

  res.json({
    appointments: sorted.map((item) => ({
      ...item,
      createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
    })),
  });
};
