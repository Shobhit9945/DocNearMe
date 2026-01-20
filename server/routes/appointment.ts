import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { getAppointmentsCollection } from "../db";
import { Appointment } from "../types";

const generateBookingId = () =>
  `DNM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const serializeAppointment = (appointment: Appointment) => ({
  ...appointment,
  _id: appointment._id
    ? appointment._id instanceof ObjectId
      ? appointment._id.toString()
      : String(appointment._id)
    : "",
  createdAt: appointment.createdAt instanceof Date ? appointment.createdAt.toISOString() : appointment.createdAt,
});

export const handleCreateAppointment = async (req: Request, res: Response) => {
  const { date, slot, specialization, clinicId, notes, patientName, patientEmail, doctorName } = req.body ?? {};

  if (!req.auth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  if (!date || !slot || !specialization) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const dateObj = new Date(date);
  if (Number.isNaN(dateObj.getTime())) {
    return res.status(400).json({ error: "Invalid appointment date" });
  }

  const clinicKey = clinicId || "global";
  const dateKey = dateObj.toISOString().split("T")[0];

  try {
    const appointments = await getAppointmentsCollection();
    const existing = await appointments.findOne({
      dateKey,
      slot,
      clinicId: clinicKey,
    });
    if (existing) {
      return res.status(409).json({ error: "Slot already booked" });
    }

    const record: Appointment = {
      date: dateObj.toISOString(),
      dateKey,
      slot,
      specialization,
      doctorName: doctorName?.trim() || undefined,
      clinicId: clinicKey,
      notes,
      patientId: req.auth.id,
      patientName: patientName?.trim() || req.auth.name,
      patientEmail: patientEmail?.trim() || req.auth.email,
      createdAt: new Date(),
    };

    const result = await appointments.insertOne(record);

    res.status(201).json({
      success: true,
      id: result.insertedId?.toString?.() ?? generateBookingId(),
      message: "Appointment booked successfully",
    });
  } catch (error) {
    console.error("Appointment booking error", error);
    res.status(500).json({ error: "Failed to book appointment" });
  }
};

export const handleListAppointments = async (_req: Request, res: Response) => {
  try {
    const appointments = await getAppointmentsCollection();
    const list = await appointments.find({}).sort({ date: 1, slot: 1 }).toArray();

    res.json({
      appointments: list.map(serializeAppointment),
    });
  } catch (error) {
    console.error("Appointment list error", error);
    res.status(500).json({ error: "Failed to load appointments" });
  }
};

export const handleListAppointmentsForUser = async (req: Request, res: Response) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const appointments = await getAppointmentsCollection();
    const list = await appointments
      .find({ patientId: req.auth.id })
      .sort({ date: 1, slot: 1 })
      .toArray();

    res.json({
      appointments: list.map(serializeAppointment),
    });
  } catch (error) {
    console.error("Appointment list error", error);
    res.status(500).json({ error: "Failed to load appointments" });
  }
};
