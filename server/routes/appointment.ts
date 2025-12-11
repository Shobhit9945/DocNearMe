import { Response } from "express";
import { ObjectId } from "mongodb";
import { getAppointmentsCollection, getUsersCollection } from "../db";
import { AuthenticatedRequest, requireRole } from "../middleware/auth";
import { Appointment } from "../types";

export const handleCreateAppointment = async (req: AuthenticatedRequest, res: Response) => {
  const { date, slot, specialization, clinicId, notes } = req.body;

  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

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

    const patient = await (await getUsersCollection()).findOne({
      _id: new ObjectId(req.user.userId),
    });

    const record: Appointment = {
      date: dateObj.toISOString(),
      dateKey,
      slot,
      specialization,
      clinicId: clinicKey,
      notes,
      patientId: req.user.userId,
      patientEmail: patient?.email,
      patientName: patient?.name,
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

export const handleListAppointments = [
  requireRole(["admin", "clinic"]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const appointments = await getAppointmentsCollection();
      const clinicFilter = req.user?.role === "clinic" ? req.user.clinicId ?? "global" : undefined;
      const query = clinicFilter ? { clinicId: clinicFilter } : {};

      const items = await appointments
        .find(query)
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
  },
];
