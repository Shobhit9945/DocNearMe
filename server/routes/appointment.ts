import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { getAppointmentsCollection, getPatientsCollection } from "../db";
import { Appointment, PatientAppointmentSummary, SharedMedicalRecord } from "../types";
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

const MAX_RECORD_SIZE_BYTES = 8 * 1024 * 1024;

const parseSharedRecord = (value: unknown): SharedMedicalRecord | null => {
  if (!value || typeof value !== "object") return null;
  const payload = value as Record<string, unknown>;
  const recordId = typeof payload.recordId === "string" ? payload.recordId : "";
  const name = typeof payload.name === "string" ? payload.name : "";
  const type = typeof payload.type === "string" ? payload.type : "";
  const size = typeof payload.size === "number" ? payload.size : Number(payload.size);
  const iv = typeof payload.iv === "string" ? payload.iv : "";
  const data = typeof payload.data === "string" ? payload.data : "";

  if (!recordId || !name || !type || !iv || !data) return null;
  if (!type.startsWith("image/") && type !== "application/pdf") return null;
  if (Number.isNaN(size) || size <= 0 || size > MAX_RECORD_SIZE_BYTES) return null;

  return { recordId, name, type, size, iv, data };
};

const serializeAppointment = (appointment: Appointment) => ({
  _id: appointment._id
    ? appointment._id instanceof ObjectId
      ? appointment._id.toString()
      : String(appointment._id)
    : "",
  date: appointment.date,
  dateKey: appointment.dateKey,
  slot: appointment.slot,
  specialization: appointment.specialization,
  doctorName: appointment.doctorName,
  clinicId: appointment.clinicId,
  notes: appointment.notes,
  patientId: appointment.patientId,
  patientName: appointment.patientName,
  patientEmail: appointment.patientEmail,
  createdAt: appointment.createdAt instanceof Date ? appointment.createdAt.toISOString() : appointment.createdAt,
});

const resolveAppointmentId = (appointmentId: string) =>
  ObjectId.isValid(appointmentId) ? new ObjectId(appointmentId) : appointmentId;

export const handleCreateAppointment = async (req: Request, res: Response) => {
  const payload = parseRequestBody(req.body);
  const { date, slot, specialization, clinicId, notes, patientName, patientEmail, doctorName, sharedRecord } =
    payload ?? {};
  const sharedRecordPayload = parseSharedRecord(sharedRecord);

  if (!req.auth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  if (!date || !slot || !specialization || !clinicId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if ((sharedRecord !== undefined && sharedRecord !== null) && !sharedRecordPayload) {
    return res.status(400).json({ error: "Invalid shared medical record." });
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
      sharedRecord: sharedRecordPayload ?? undefined,
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

export const handleRescheduleAppointment = async (req: Request, res: Response) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const appointmentId = req.params.id;
  const payload = parseRequestBody(req.body);
  const { date, slot, reason } = payload ?? {};

  if (!date || !slot || !reason) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const dateObj = new Date(date);
  if (Number.isNaN(dateObj.getTime())) {
    return res.status(400).json({ error: "Invalid appointment date" });
  }

  try {
    const appointments = await getAppointmentsCollection();
    const appointmentLookup = resolveAppointmentId(appointmentId);
    const appointment = await appointments.findOne({ _id: appointmentLookup });

    if (!appointment || appointment.patientId !== req.auth.id) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    const dateKey = dateObj.toISOString().split("T")[0];
    const conflict = await appointments.findOne({
      dateKey,
      slot,
      clinicId: appointment.clinicId,
    });

    if (conflict && String(conflict._id) !== String(appointment._id)) {
      return res.status(409).json({ error: "Slot already booked" });
    }

    await appointments.updateOne(
      { _id: appointmentLookup },
      {
        $set: {
          date: dateObj.toISOString(),
          dateKey,
          slot,
        },
      },
    );

    const patients = await getPatientsCollection();
    const patientLookupId = ObjectId.isValid(req.auth.id) ? new ObjectId(req.auth.id) : req.auth.id;
    const patient = await patients.findOne({ _id: patientLookupId });
    if (patient?.appointments) {
      const updatedAppointments = patient.appointments.map((summary) =>
        summary.appointmentId === appointmentId
          ? {
              ...summary,
              date: dateObj.toISOString(),
              slot: String(slot),
            }
          : summary,
      );
      await patients.updateOne(
        { _id: patientLookupId },
        {
          $set: {
            appointments: updatedAppointments,
          },
        },
      );
    }

    res.json({
      success: true,
      appointment: serializeAppointment({
        ...appointment,
        date: dateObj.toISOString(),
        dateKey,
        slot: String(slot),
      }),
      message: "Appointment rescheduled successfully",
    });
  } catch (error) {
    console.error("Appointment reschedule error", error);
    res.status(500).json({ error: "Failed to reschedule appointment" });
  }
};

export const handleCancelAppointment = async (req: Request, res: Response) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const appointmentId = req.params.id;
  const payload = parseRequestBody(req.body);
  const { reason } = payload ?? {};

  if (!reason) {
    return res.status(400).json({ error: "Cancellation reason is required" });
  }

  try {
    const appointments = await getAppointmentsCollection();
    const appointmentLookup = resolveAppointmentId(appointmentId);
    const appointment = await appointments.findOne({ _id: appointmentLookup });

    if (!appointment || appointment.patientId !== req.auth.id) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    await appointments.deleteOne({ _id: appointmentLookup });

    const patients = await getPatientsCollection();
    const patientLookupId = ObjectId.isValid(req.auth.id) ? new ObjectId(req.auth.id) : req.auth.id;
    const patient = await patients.findOne({ _id: patientLookupId });
    if (patient?.appointments) {
      const updatedAppointments = patient.appointments.filter(
        (summary) => summary.appointmentId !== appointmentId,
      );
      await patients.updateOne(
        { _id: patientLookupId },
        {
          $set: {
            appointments: updatedAppointments,
          },
        },
      );
    }

    res.json({
      success: true,
      message: "Appointment cancelled successfully",
    });
  } catch (error) {
    console.error("Appointment cancellation error", error);
    res.status(500).json({ error: "Failed to cancel appointment" });
  }
};
