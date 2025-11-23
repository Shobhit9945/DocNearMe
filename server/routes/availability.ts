import { Request, Response } from "express";
import { db } from "../db";

export const handleAvailability = (req: Request, res: Response) => {
    const { date, clinicId } = req.query;

    if (!date) {
        return res.status(400).json({ error: "Date parameter is required" });
    }

    const selectedDate = new Date(date as string);
    const dayOfWeek = selectedDate.getDay(); // 0 = Sunday, 6 = Saturday

    // Fetch all slots from DB
    const allSlots = db.prepare("SELECT time FROM slots").all() as { time: string }[];
    let availableSlots = allSlots.map(s => s.time);

    // Weekends have limited availability (Business Logic)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        const weekendSlots = [
            "10:00 AM", "10:30 AM", "11:00 AM",
            "02:00 PM", "02:30 PM", "03:00 PM"
        ];
        availableSlots = availableSlots.filter(slot => weekendSlots.includes(slot));
    }

    // Fetch booked slots for this date
    // We store date as ISO string in DB usually, but let's normalize.
    // The frontend sends ISO string. Let's assume we store just the date part or full ISO.
    // The frontend sends `selectedDate.toISOString()`.
    // Let's match based on the date part to be safe, or exact string if we are consistent.
    // `selectedDate` is a Date object. `date` is the query param string.
    // Let's use the query param string directly if it's just YYYY-MM-DD or similar,
    // but `toISOString` includes time.
    // Let's extract YYYY-MM-DD from the input date string to be robust.

    const dateObj = new Date(date as string);
    const dateStr = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD

    const bookedAppointments = db.prepare(
        "SELECT slot FROM appointments WHERE substr(date, 1, 10) = ?"
    ).all(dateStr) as { slot: string }[];

    const bookedSlots = new Set(bookedAppointments.map(a => a.slot));

    // Filter out booked slots
    availableSlots = availableSlots.filter(slot => !bookedSlots.has(slot));

    // Simulate network delay
    setTimeout(() => {
        res.json({
            date: dateStr,
            clinicId: clinicId || "all",
            slots: availableSlots
        });
    }, 500);
};
