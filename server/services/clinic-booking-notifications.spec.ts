import { describe, expect, it, vi } from "vitest";

vi.mock("./mailer", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

const loadNotificationsModule = async () => {
  vi.resetModules();
  process.env.USE_IN_MEMORY_DB = "true";
  process.env.ALLOW_IN_MEMORY_DB = "true";
  return await import("./clinic-booking-notifications");
};

describe("clinic booking notifications", () => {
  it("skips sending when notification already sent", async () => {
    const { shouldSendClinicBookingNotification } = await loadNotificationsModule();
    const shouldSend = shouldSendClinicBookingNotification({
      date: "2026-02-03T10:00:00.000Z",
      dateKey: "2026-02-03",
      slot: "10:00",
      preferredStart: "2026-02-03T10:00:00.000Z",
      preferredEnd: "2026-02-03T10:30:00.000Z",
      status: "PENDING_CLINIC",
      specialization: "Dermatology",
      clinicId: "clinic-1",
      createdAt: new Date(),
      notificationSentAt: new Date(),
    });

    expect(shouldSend).toBe(false);
  });

  it("builds JP subject and includes core fields", async () => {
    const { buildClinicBookingNotificationEmail } = await loadNotificationsModule();
    const payload = buildClinicBookingNotificationEmail("clinic@example.com", {
      clinicName: "さくらクリニック",
      patientName: "山田 太郎",
      requestedDateTime: "2026/02/03 19:00",
      specialization: "内科",
      statusLabel: "承認待ち",
      portalUrl: "https://clinic.docnearme.app/appointments",
    });

    expect(payload.subject).toBe("【DocNearMe】新しい予約リクエストがあります");
    expect(payload.text).toContain("さくらクリニック");
    expect(payload.text).toContain("山田 太郎");
    expect(payload.text).toContain("2026/02/03 19:00");
    expect(payload.text).toContain("内科");
    expect(payload.text).toContain("承認待ち");
    expect(payload.text).toContain("https://clinic.docnearme.app/appointments");
  });

  it("logs and returns null for missing clinic email", async () => {
    const { resolveClinicNotificationRecipient } = await loadNotificationsModule();
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const recipient = resolveClinicNotificationRecipient({ clinicId: "clinic-1", email: "" }, logger);

    expect(recipient).toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });

  it("marks appointment notification as sent", async () => {
    const { sendClinicBookingNotificationEmail } = await loadNotificationsModule();
    const { getAppointmentsCollection, getClinicInfoCollection } = await import("../db");

    const clinicId = "clinic-integration";
    const appointments = await getAppointmentsCollection();
    const clinics = await getClinicInfoCollection();

    await clinics.insertOne({
      clinicId,
      name: "Integration Clinic",
      type: "Clinic",
      rating: 4.8,
      patients: "1200+",
      distance: "1 km",
      location: "Tokyo",
      image: "https://example.com/clinic.jpg",
      specializations: ["Dermatology"],
      nextAvailability: "Tomorrow",
      email: "notify@clinic.test",
      updatedAt: new Date(),
    });

    const appointmentInsert = await appointments.insertOne({
      date: "2026-02-03T10:00:00.000Z",
      dateKey: "2026-02-03",
      slot: "10:00",
      preferredStart: "2026-02-03T10:00:00.000Z",
      preferredEnd: "2026-02-03T10:30:00.000Z",
      status: "PENDING_CLINIC",
      specialization: "Dermatology",
      clinicId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await sendClinicBookingNotificationEmail(
      clinicId,
      appointmentInsert.insertedId.toString(),
    );
    expect(result).toBe(true);

    const updated = await appointments.findOne({ _id: appointmentInsert.insertedId });
    expect(updated?.notificationSentAt).toBeInstanceOf(Date);
  });
});
