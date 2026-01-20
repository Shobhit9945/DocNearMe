import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { getAppointmentsCollection, getPatientsCollection } from "../db";
import { Appointment, PatientAppointmentSummary } from "../types";
import { sendEmail } from "../services/mailer";

const parseRequestBody = (body: unknown): Record<string, unknown> => {
  if (body instanceof Buffer) {
    return parseRequestBody(body.toString("utf8"));
  }
  if (body instanceof Uint8Array) {
    return parseRequestBody(Buffer.from(body).toString("utf8"));
  }
  if (body && typeof body === "object") return body as Record<string, unknown>;
  if (typeof body !== "string") return {};

  const trimmed = body.trim();
  if (!trimmed) return {};

  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const params = new URLSearchParams(trimmed);
    const payload: Record<string, string> = {};
    params.forEach((value, key) => {
      payload[key] = value;
    });
    return payload;
  }
};

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
  const payload = parseRequestBody(req.body);
  const { date, slot, specialization, clinicId, notes, patientName, patientEmail, doctorName } = payload ?? {};

  if (!req.auth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  if (!date || !slot || !specialization || !clinicId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const dateObj = new Date(date);
  if (Number.isNaN(dateObj.getTime())) {
    return res.status(400).json({ error: "Invalid appointment date" });
  }

  const clinicKey = clinicId;
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
    const appointmentId = result.insertedId?.toString?.() ?? generateBookingId();

    const patients = await getPatientsCollection();
    const patientAppointment: PatientAppointmentSummary = {
      appointmentId,
      date: record.date,
      slot: record.slot,
      specialization: record.specialization,
      doctorName: record.doctorName,
      clinicId: record.clinicId,
      createdAt: record.createdAt,
    };

    const patientLookupId = ObjectId.isValid(req.auth.id) ? new ObjectId(req.auth.id) : req.auth.id;
    await patients.updateOne(
      { _id: patientLookupId },
      {
        $push: { appointments: patientAppointment },
      },
    );

    const emailAddress = record.patientEmail;
    if (emailAddress) {
      const appointmentDate = new Date(record.date);
      const formattedDate = Number.isNaN(appointmentDate.getTime())
        ? record.date
        : appointmentDate.toLocaleString();

      try {
        await sendEmail({
          to: emailAddress,
          subject: "Your DocNearMe appointment is confirmed",
          text: [
            `Hi ${record.patientName ?? "there"},`,
            "",
            "Your appointment is confirmed. Here are your booking details:",
            `Booking ID: ${appointmentId}`,
            `Clinic: ${record.clinicId}`,
            "Clinic location: (placeholder - coming soon)",
            `Patient: ${record.patientName ?? "Patient"}`,
            `Doctor: ${record.doctorName ?? "To be assigned"}`,
            `Specialization: ${record.specialization}`,
            `Date: ${formattedDate}`,
            `Time: ${record.slot}`,
            "",
            "Please arrive 10 minutes early and bring a photo ID and insurance card if applicable.",
            "To reschedule, contact the clinic from the DocNearMe web app.",
          ].join("\n"),
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.5;">
              <h2 style="margin-bottom: 12px;">Appointment Confirmed</h2>
              <p>Hi ${record.patientName ?? "there"},</p>
              <p>Your appointment is confirmed. Here are your booking details:</p>
              <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
                <tbody>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b; width: 140px;">Booking ID</td>
                    <td style="padding: 6px 0; font-weight: 600;">${appointmentId}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Clinic</td>
                    <td style="padding: 6px 0; font-weight: 600;">${record.clinicId}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Clinic location</td>
                    <td style="padding: 6px 0; font-weight: 600;">(placeholder - coming soon)</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Patient</td>
                    <td style="padding: 6px 0; font-weight: 600;">${record.patientName ?? "Patient"}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Doctor</td>
                    <td style="padding: 6px 0; font-weight: 600;">${record.doctorName ?? "To be assigned"}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Specialization</td>
                    <td style="padding: 6px 0; font-weight: 600;">${record.specialization}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Date</td>
                    <td style="padding: 6px 0; font-weight: 600;">${formattedDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Time</td>
                    <td style="padding: 6px 0; font-weight: 600;">${record.slot}</td>
                  </tr>
                </tbody>
              </table>
              <p>Please arrive 10 minutes early and bring a photo ID and insurance card if applicable.</p>
              <p>To reschedule, contact the clinic from the DocNearMe web app.</p>
            </div>
          `,
        });
      } catch (error) {
        console.error("Failed to send appointment confirmation email", error);
      }
    }

    res.status(201).json({
      success: true,
      id: appointmentId,
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
