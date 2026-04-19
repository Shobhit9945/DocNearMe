import supertest from "supertest";
import { createHmac } from "crypto";
import { ObjectId } from "mongodb";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

describe("voice outcome webhook", () => {
  let app: Awaited<ReturnType<typeof import("../index").createServer>>;
  let request: supertest.SuperTest<supertest.Test>;
  let getAppointmentsCollection: typeof import("../db").getAppointmentsCollection;
  let getClinicInfoCollection: typeof import("../db").getClinicInfoCollection;
  let buildVoiceToken: typeof import("../services/twilio-voice").buildVoiceToken;

  beforeAll(async () => {
    process.env.USE_IN_MEMORY_DB = "true";
    process.env.ALLOW_IN_MEMORY_DB = "true";
    process.env.SMTP_LOG_ONLY = "true";
    process.env.AUTH_JWT_SECRET = "test-auth-secret-with-at-least-32-chars";
    process.env.CLINIC_JWT_SECRET = "test-clinic-secret-with-at-least-32-chars";
    process.env.ADMIN_USERNAME = "admin@example.com";
    process.env.ADMIN_PASSWORD = "super-secret-password";
    process.env.VOICE_WEBHOOK_SECRET = "voice-webhook-secret-test";
    process.env.ELEVENLABS_OUTCOME_WEBHOOK_SECRET = "docdaisy_secret_2026";

    const [{ createServer: createServerImpl }, dbModule, twilioModule] = await Promise.all([
      import("../index"),
      import("../db"),
      import("../services/twilio-voice"),
    ]);

    app = await createServerImpl();
    request = supertest(app);
    getAppointmentsCollection = dbModule.getAppointmentsCollection;
    getClinicInfoCollection = dbModule.getClinicInfoCollection;
    buildVoiceToken = twilioModule.buildVoiceToken;
  });

  beforeEach(async () => {
    const appointments = await getAppointmentsCollection();
    const clinics = await getClinicInfoCollection();

    await appointments.deleteMany({});
    await clinics.deleteMany({});

    vi.restoreAllMocks();
  });

  it("accepts an outcome callback sent as urlencoded form data", async () => {
    const clinicId = "voice-clinic-form";
    const appointmentId = "69e4a0000000000000000001";
    const appointmentObjectId = new ObjectId(appointmentId);
    const token = buildVoiceToken(appointmentId);

    const clinics = await getClinicInfoCollection();
    const appointments = await getAppointmentsCollection();

    await clinics.insertOne({
      clinicId,
      name: "Voice Clinic",
      type: "Clinic",
      rating: 4.8,
      patients: "1000+",
      distance: "1 km",
      location: "Tokyo",
      image: "https://example.com/clinic.jpg",
      specializations: ["Dermatology"],
      nextAvailability: "Tomorrow",
      phone: "+81123456789",
      hours: {
        weekdays: { start: "09:00", end: "18:00" },
        weekend: { start: "10:00", end: "16:00" },
        closedDays: [],
        slotMinutes: 30,
      },
      updatedAt: new Date(),
    });

    await appointments.insertOne({
      _id: appointmentObjectId,
      date: "2026-02-03T10:00:00.000Z",
      dateKey: "2026-02-03",
      slot: "10:00 AM",
      preferredStart: "2026-02-03T10:00:00.000Z",
      preferredEnd: "2026-02-03T10:30:00.000Z",
      status: "PENDING_CLINIC",
      clinicId,
      specialization: "Dermatology",
      patientName: "Test Patient",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await request
      .post("/api/voice/appointment/outcome")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .set("x-docnearme-webhook-secret", "docdaisy_secret_2026")
      .send(`appointmentId=${appointmentId}&token=${encodeURIComponent(token)}&outcome=confirm`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, status: "CONFIRMED" });

    const updated = await appointments.findOne({ _id: appointmentObjectId });
    expect(updated?.status).toBe("CONFIRMED");
    expect(updated?.confirmedStart).toBe("2026-02-03T10:00:00.000Z");
  });

  it("rejects confirmed outcomes that collide with existing appointments", async () => {
    const clinicId = "voice-clinic-overlap";
    const appointmentId = "69e4a0000000000000000002";
    const appointmentObjectId = new ObjectId(appointmentId);
    const token = buildVoiceToken(appointmentId);
    const overlapId = "69e4a0000000000000000099";
    const overlapObjectId = new ObjectId(overlapId);

    const clinics = await getClinicInfoCollection();
    const appointments = await getAppointmentsCollection();

    await clinics.insertOne({
      clinicId,
      name: "Overlap Clinic",
      type: "Clinic",
      rating: 4.8,
      patients: "1000+",
      distance: "1 km",
      location: "Tokyo",
      image: "https://example.com/clinic.jpg",
      specializations: ["Dermatology"],
      nextAvailability: "Tomorrow",
      phone: "+81123456789",
      hours: {
        weekdays: { start: "09:00", end: "18:00" },
        weekend: { start: "10:00", end: "16:00" },
        closedDays: [],
        slotMinutes: 30,
      },
      updatedAt: new Date(),
    });

    await appointments.insertOne({
      _id: overlapObjectId,
      date: "2026-02-03T10:00:00.000Z",
      dateKey: "2026-02-03",
      slot: "10:00 AM",
      preferredStart: "2026-02-03T10:00:00.000Z",
      preferredEnd: "2026-02-03T10:30:00.000Z",
      confirmedStart: "2026-02-03T10:00:00.000Z",
      confirmedEnd: "2026-02-03T10:30:00.000Z",
      status: "CONFIRMED",
      clinicId,
      specialization: "Dermatology",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await appointments.insertOne({
      _id: appointmentObjectId,
      date: "2026-02-03T10:15:00.000Z",
      dateKey: "2026-02-03",
      slot: "10:15 AM",
      preferredStart: "2026-02-03T10:15:00.000Z",
      preferredEnd: "2026-02-03T10:45:00.000Z",
      status: "PENDING_CLINIC",
      clinicId,
      specialization: "Dermatology",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await request
      .post("/api/voice/appointment/outcome")
      .set("x-docnearme-webhook-secret", "docdaisy_secret_2026")
      .send({
        appointmentId,
        token,
        outcome: "confirm",
        confirmedStart: "2026-02-03T10:15:00.000Z",
        confirmedEnd: "2026-02-03T10:45:00.000Z",
      });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ error: "Requested time is already booked." });

    const updated = await appointments.findOne({ _id: appointmentObjectId });
    expect(updated?.status).toBe("PENDING_CLINIC");
  });

  it("accepts repeated identical outcomes as idempotent replays", async () => {
    const clinicId = "voice-clinic-idempotent";
    const appointmentId = "69e4a0000000000000000003";
    const appointmentObjectId = new ObjectId(appointmentId);
    const token = buildVoiceToken(appointmentId);

    const clinics = await getClinicInfoCollection();
    const appointments = await getAppointmentsCollection();

    await clinics.insertOne({
      clinicId,
      name: "Idempotent Clinic",
      type: "Clinic",
      rating: 4.8,
      patients: "1000+",
      distance: "1 km",
      location: "Tokyo",
      image: "https://example.com/clinic.jpg",
      specializations: ["Dermatology"],
      nextAvailability: "Tomorrow",
      phone: "+81123456789",
      hours: {
        weekdays: { start: "09:00", end: "18:00" },
        weekend: { start: "10:00", end: "16:00" },
        closedDays: [],
        slotMinutes: 30,
      },
      updatedAt: new Date(),
    });

    await appointments.insertOne({
      _id: appointmentObjectId,
      date: "2026-02-03T10:00:00.000Z",
      dateKey: "2026-02-03",
      slot: "10:00 AM",
      preferredStart: "2026-02-03T10:00:00.000Z",
      preferredEnd: "2026-02-03T10:30:00.000Z",
      status: "PENDING_CLINIC",
      clinicId,
      specialization: "Dermatology",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const first = await request
      .post("/api/voice/appointment/outcome")
      .set("x-docnearme-webhook-secret", "docdaisy_secret_2026")
      .send({
        appointmentId,
        token,
        outcome: "decline",
        declineReason: "Clinic not available",
      });

    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ success: true, status: "DECLINED" });

    const replay = await request
      .post("/api/voice/appointment/outcome")
      .set("x-docnearme-webhook-secret", "docdaisy_secret_2026")
      .send({
        appointmentId,
        token,
        outcome: "decline",
        declineReason: "Clinic not available",
      });

    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({ success: true, status: "DECLINED", idempotent: true });
  });

  it("accepts webhook secret fallback when token is missing or invalid", async () => {
    const clinicId = "voice-clinic-secret";
    const appointmentId = "69e4a0000000000000000004";
    const appointmentObjectId = new ObjectId(appointmentId);

    const clinics = await getClinicInfoCollection();
    const appointments = await getAppointmentsCollection();

    await clinics.insertOne({
      clinicId,
      name: "Secret Clinic",
      type: "Clinic",
      rating: 4.8,
      patients: "1000+",
      distance: "1 km",
      location: "Tokyo",
      image: "https://example.com/clinic.jpg",
      specializations: ["Dermatology"],
      nextAvailability: "Tomorrow",
      phone: "+81123456789",
      hours: {
        weekdays: { start: "09:00", end: "18:00" },
        weekend: { start: "10:00", end: "16:00" },
        closedDays: [],
        slotMinutes: 30,
      },
      updatedAt: new Date(),
    });

    await appointments.insertOne({
      _id: appointmentObjectId,
      date: "2026-02-03T10:00:00.000Z",
      dateKey: "2026-02-03",
      slot: "10:00 AM",
      preferredStart: "2026-02-03T10:00:00.000Z",
      preferredEnd: "2026-02-03T10:30:00.000Z",
      status: "PENDING_CLINIC",
      clinicId,
      specialization: "Dermatology",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await request
      .post("/api/voice/appointment/outcome")
      .set("x-docnearme-webhook-secret", "docdaisy_secret_2026")
      .send({
        finalize_url: `https://www.clinic.docnearme.jp/api/voice/appointment/outcome?appointmentId=${appointmentId}&token=wrong-token`,
        outcome: "confirm",
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, status: "CONFIRMED" });
  });

  it("accepts signed webhook callbacks and rejects stale signatures", async () => {
    const clinicId = "voice-clinic-signature";
    const appointmentId = "69e4a0000000000000000005";
    const appointmentObjectId = new ObjectId(appointmentId);
    const signingSecret = "signed-webhook-secret-test";
    process.env.ELEVENLABS_OUTCOME_WEBHOOK_SIGNING_SECRET = signingSecret;

    const clinics = await getClinicInfoCollection();
    const appointments = await getAppointmentsCollection();

    await clinics.insertOne({
      clinicId,
      name: "Signature Clinic",
      type: "Clinic",
      rating: 4.8,
      patients: "1000+",
      distance: "1 km",
      location: "Tokyo",
      image: "https://example.com/clinic.jpg",
      specializations: ["Dermatology"],
      nextAvailability: "Tomorrow",
      phone: "+81123456789",
      hours: {
        weekdays: { start: "09:00", end: "18:00" },
        weekend: { start: "10:00", end: "16:00" },
        closedDays: [],
        slotMinutes: 30,
      },
      updatedAt: new Date(),
    });

    await appointments.insertOne({
      _id: appointmentObjectId,
      date: "2026-02-03T10:00:00.000Z",
      dateKey: "2026-02-03",
      slot: "10:00 AM",
      preferredStart: "2026-02-03T10:00:00.000Z",
      preferredEnd: "2026-02-03T10:30:00.000Z",
      status: "PENDING_CLINIC",
      clinicId,
      specialization: "Dermatology",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const rawBody = JSON.stringify({ appointmentId, token: "not-needed", outcome: "decline" });
    const timestamp = String(Date.now());
    const signature = createHmac("sha256", signingSecret).update(`${timestamp}.${rawBody}`).digest("hex");

    const response = await request
      .post("/api/voice/appointment/outcome")
      .set("Content-Type", "application/json")
      .set("x-docnearme-webhook-signature", signature)
      .set("x-docnearme-webhook-timestamp", timestamp)
      .send(rawBody);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, status: "DECLINED" });

    const staleTimestamp = String(Date.now() - 10 * 60 * 1000);
    const staleSignature = createHmac("sha256", signingSecret).update(`${staleTimestamp}.${rawBody}`).digest("hex");

    const staleResponse = await request
      .post("/api/voice/appointment/outcome")
      .set("Content-Type", "application/json")
      .set("x-docnearme-webhook-signature", staleSignature)
      .set("x-docnearme-webhook-timestamp", staleTimestamp)
      .send(rawBody);

    expect(staleResponse.status).toBe(401);
    expect(staleResponse.body).toMatchObject({ error: "Invalid voice token." });

    const replayResponse = await request
      .post("/api/voice/appointment/outcome")
      .set("Content-Type", "application/json")
      .set("x-docnearme-webhook-signature", signature)
      .set("x-docnearme-webhook-timestamp", timestamp)
      .send(rawBody);

    expect(replayResponse.status).toBe(409);
    expect(replayResponse.body).toMatchObject({ error: "Replay detected." });
  });
});