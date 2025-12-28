import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { getAppointmentsCollection } from "../db";
import { Appointment } from "../types";

export const handleCreateAppointment = async (req: Request, res: Response) => {
  const { date, slot, specialization, clinicId, notes, patientName, patientEmail } = req.body;

  if (!date || !slot || !specialization) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const clinicKey = clinicId || "global";

  try {
    const appointments = await getAppointmentsCollection();

    const dateObj = new Date(date);
    const dateKey = dateObj.toISOString().split("T")[0];

    const existing = await appointments.findOne({ dateKey, slot, clinicId: clinicKey });
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

    const result = await appointments.insertOne(record);

    res
      .status(201)
      .json({ success: true, id: result.insertedId.toString(), message: "Appointment booked successfully" });
  } catch (error) {
    console.error("Booking error:", error);
    res.status(500).json({ error: "Failed to book appointment" });
  }
};

export const handleListAppointments = async (_req: Request, res: Response) => {
  try {
    const appointments = await getAppointmentsCollection();
    const items = await appointments
      .find({})
      .sort({ date: 1, slot: 1 })
      .toArray();

    const serialized = items.map((item) => ({
      ...item,
      _id: (item._id as ObjectId).toString(),
      createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
    }));

    res.json({ appointments: serialized });
  } catch (error) {
    console.error("List appointments error", error);
    res.status(500).json({ error: "Failed to load appointments" });
  }
};
