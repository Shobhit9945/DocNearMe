import { Request, Response } from "express";
import { db } from "../db";

export const handleCreateAppointment = (req: Request, res: Response) => {
    const { date, slot, specialization, clinicId, notes } = req.body;

    if (!date || !slot || !specialization) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    const dateObj = new Date(date);
    const dateStr = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD

    // Check if slot is already booked
    const existing = db.prepare(
        "SELECT id FROM appointments WHERE substr(date, 1, 10) = ? AND slot = ?"
    ).get(dateStr, slot);

    if (existing) {
        return res.status(409).json({ error: "Slot already booked" });
    }

    try {
        const insert = db.prepare(`
            INSERT INTO appointments (date, slot, specialization, clinicId, notes)
            VALUES (?, ?, ?, ?, ?)
        `);

        const result = insert.run(dateObj.toISOString(), slot, specialization, clinicId, notes);

        res.status(201).json({
            success: true,
            id: result.lastInsertRowid,
            message: "Appointment booked successfully"
        });
    } catch (error) {
        console.error("Booking error:", error);
        res.status(500).json({ error: "Failed to book appointment" });
    }
};
