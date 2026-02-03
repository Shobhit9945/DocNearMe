import "dotenv/config";
import express, { Express } from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleAvailability } from "./routes/availability";
import {
  handleCancelAppointment,
  handleClinicCancelAppointment,
  handleClinicConfirmAppointment,
  handleClinicDeleteAppointment,
  handleClinicDeclineAppointment,
  handleClinicPatientDetails,
  handleClinicRescheduleMessage,
  handleConfirmAppointment,
  handleDeclineAppointment,
  handleListAppointments,
  handleListAppointmentsForClinic,
  handleListAppointmentsForUser,
  handleRequestAppointment,
  handleRescheduleAppointment,
} from "./routes/appointment";
import {
  handleGetClinicIntakeForm,
  handleGetClinicIntakeFormForClinic,
  handleUpdateClinicIntakeForm,
} from "./routes/intake";
import docDaisyRouter from "./routes/docdaisy";
import healthRouter from "./routes/health";
import {
  handleLogin,
  handleCheckEmail,
  handleRequestOtp,
  handleRequestPasswordReset,
  handleRequestPhoneOtp,
  handleResetPassword,
  handleSignup,
  handleVerifyOtp,
  handleVerifyPhoneOtp,
} from "./routes/auth";
import { requireAuth } from "./middleware/auth";
import {
  handleCreateMedicalConsent,
  handleDeleteMedicalRecord,
  handleGetMedicalConsent,
  handleGetMedicalRecord,
  handleGetMedicalRecordKey,
  handleListMedicalRecords,
  handleRenameMedicalRecord,
  handleUpsertMedicalRecordKey,
  handleUploadMedicalRecord,
} from "./routes/medical-records";
import {
  handleCreateClinicReview,
  handleDeleteClinicReview,
  handleListClinicReviews,
  handleUpdateClinicReview,
} from "./routes/clinic-reviews";
import {
  handleCreateVaultDoc,
  handleCreateVaultKeys,
  handleDeleteVaultDoc,
  handleGetVaultKeys,
  handleListVaultDocs,
  handleRenameVaultDoc,
  handleUpdateVaultPassword,
} from "./routes/vault";
import { handleGeocode, handlePlaceAutocomplete, handlePlaceDetails } from "./routes/google-maps";
import {
  handleClinicCredentials,
  handleClinicDoctors,
  handleClinicDoctorsAll,
  handleClinicList,
  handleClinicLogin,
  handleClinicMe,
  handleClinicProfile,
  handleAddClinicClosure,
  handleDeleteClinicClosure,
  handlePatchClinicMe,
  handleUpdateClinicDoctors,
  handleUpdateClinicProfile,
} from "./routes/clinic";
import { requireClinicAuth } from "./middleware/clinic-auth";
import { requireAdminAuth } from "./middleware/admin-auth";
import { handleAdminAuthCheck, handleAdminClinicList, handleAdminCreateClinic } from "./routes/admin";
import { handleGetProfile, handleUpdateProfile } from "./routes/profile";
import { handleTranslate } from "./routes/translate";
import {
  handleCreateVaultDoc,
  handleCreateVaultKeys,
  handleDeleteVaultDoc,
  handleGetVaultKeys,
  handleListVaultDocs,
  handleRenameVaultDoc,
  handleUpdateVaultPassword,
} from "./routes/vault";

export async function createServer(): Promise<Express> {
  const app = express();

  // Middleware
  const allowedOrigins = [
    "https://docnearby.netlify.app", 
    "https://docnearme.jp",
    "https://www.docnearme.jp",
    "https://clinic.docnearme.jp",
    "https://docnearme.app",
    "https://www.docnearme.app",
    "https://clinic.docnearme.app",
    "https://admin.docnearme.app",
    "https://clinics.docnearme.app",
    "http://localhost:5173", 
    "http://localhost:3000",
    "http://0.0.0.0:3000",
    "http://127.0.0.1:3000"
  ];
  const allowedOriginSet = new Set(allowedOrigins);
  const isDev = process.env.NODE_ENV !== "production";
  const isDevOrigin = (origin: string) =>
    /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?$/i.test(origin);
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOriginSet.has(origin)) {
          callback(null, true);
          return;
        }
        if (isDev && isDevOrigin(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("Not allowed by CORS"));
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );

  // Parse JSON even if Netlify drops/changes Content-Type
  app.use(express.json({ type: "*/*", limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));


  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);
  app.get("/api/availability", handleAvailability);
  app.post("/api/appointments", requireAuth, handleRequestAppointment);
  app.post("/api/appointments/request", requireAuth, handleRequestAppointment);
  app.patch("/api/appointments/:id/reschedule", requireAuth, handleRescheduleAppointment);
  app.patch("/api/appointments/:id/cancel", requireAuth, handleCancelAppointment);
  app.post("/api/appointments/:id/confirm", handleConfirmAppointment);
  app.post("/api/appointments/:id/decline", handleDeclineAppointment);
  app.get("/api/appointments/:id/confirm", handleConfirmAppointment);
  app.get("/api/appointments/:id/decline", handleDeclineAppointment);
  app.get("/api/appointments", handleListAppointments);
  app.get("/api/appointments/me", requireAuth, handleListAppointmentsForUser);
  app.get("/api/clinic/appointments", requireClinicAuth, handleListAppointmentsForClinic);
  app.get("/api/clinic/appointments/:id/patient", requireClinicAuth, handleClinicPatientDetails);
  app.post("/api/clinic/appointments/:id/cancel", requireClinicAuth, handleClinicCancelAppointment);
  app.post("/api/clinic/appointments/:id/confirm", requireClinicAuth, handleClinicConfirmAppointment);
  app.post("/api/clinic/appointments/:id/decline", requireClinicAuth, handleClinicDeclineAppointment);
  app.post("/api/clinic/appointments/:id/reschedule-message", requireClinicAuth, handleClinicRescheduleMessage);
  app.delete("/api/clinic/appointments/:id", requireClinicAuth, handleClinicDeleteAppointment);
  app.get("/api/clinic/intake-form", requireClinicAuth, handleGetClinicIntakeFormForClinic);
  app.put("/api/clinic/intake-form", requireClinicAuth, handleUpdateClinicIntakeForm);
  app.get("/api/clinic/me", requireClinicAuth, handleClinicMe);
  app.patch("/api/clinic/me", requireClinicAuth, handlePatchClinicMe);
  app.post("/api/clinic/me/closures", requireClinicAuth, handleAddClinicClosure);
  app.delete("/api/clinic/me/closures/:closureId", requireClinicAuth, handleDeleteClinicClosure);
  app.post("/api/auth/signup", handleSignup);
  app.post("/api/auth/login", handleLogin);
  app.post("/api/auth/check-email", handleCheckEmail);
  app.get("/api/auth/request-otp", (_req, res) => {
    res.status(405).json({
      success: false,
      message: "Use POST /api/auth/request-otp to request a verification code.",
    });
  });
  app.get("/api/auth/request-phone-otp", (_req, res) => {
    res.status(405).json({
      success: false,
      message: "Use POST /api/auth/request-phone-otp to request a phone verification code.",
    });
  });
  app.get("/api/auth/verify-phone-otp", (_req, res) => {
    res.status(405).json({
      success: false,
      message: "Use POST /api/auth/verify-phone-otp to verify a phone code.",
    });
  });
  app.post("/api/auth/request-otp", handleRequestOtp);
  app.post("/api/auth/verify-otp", handleVerifyOtp);
  app.post("/api/auth/request-phone-otp", handleRequestPhoneOtp);
  app.post("/api/auth/verify-phone-otp", handleVerifyPhoneOtp);
  app.post("/api/auth/request-password-reset", handleRequestPasswordReset);
  app.post("/api/auth/reset-password", handleResetPassword);
  app.get("/api/profile", requireAuth, handleGetProfile);
  app.put("/api/profile", requireAuth, handleUpdateProfile);
  app.post("/api/clinic-auth/login", handleClinicLogin);
  app.get("/api/clinic-credentials", handleClinicCredentials);
  app.get("/api/admin/auth-check", requireAdminAuth, handleAdminAuthCheck);
  app.get("/api/admin/clinics", requireAdminAuth, handleAdminClinicList);
  app.post("/api/admin/clinics", requireAdminAuth, handleAdminCreateClinic);
  app.get("/api/clinics", handleClinicList);
  app.get("/api/clinics/doctors", handleClinicDoctorsAll);
  app.get("/api/clinics/:clinicId", handleClinicProfile);
  app.get("/api/clinics/:clinicId/intake-form", handleGetClinicIntakeForm);
  app.get("/api/clinics/:clinicId/doctors", handleClinicDoctors);
  app.put("/api/clinics/:clinicId", requireClinicAuth, handleUpdateClinicProfile);
  app.put("/api/clinics/:clinicId/doctors", requireClinicAuth, handleUpdateClinicDoctors);
  app.get("/api/medical-records/consent", requireAuth, handleGetMedicalConsent);
  app.post("/api/medical-records/consent", requireAuth, handleCreateMedicalConsent);
  app.get("/api/medical-records/key", requireAuth, handleGetMedicalRecordKey);
  app.post("/api/medical-records/key", requireAuth, handleUpsertMedicalRecordKey);
  app.get("/api/medical-records", requireAuth, handleListMedicalRecords);
  app.get("/api/medical-records/:id", requireAuth, handleGetMedicalRecord);
  app.post("/api/medical-records", requireAuth, handleUploadMedicalRecord);
  app.delete("/api/medical-records/:id", requireAuth, handleDeleteMedicalRecord);
  app.patch("/api/medical-records/:id", requireAuth, handleRenameMedicalRecord);
  app.get("/api/vault/keys", requireAuth, handleGetVaultKeys);
  app.post("/api/vault/keys", requireAuth, handleCreateVaultKeys);
  app.put("/api/vault/keys/password", requireAuth, handleUpdateVaultPassword);
  app.get("/api/vault/docs", requireAuth, handleListVaultDocs);
  app.post("/api/vault/docs", requireAuth, handleCreateVaultDoc);
  app.patch("/api/vault/docs/:id", requireAuth, handleRenameVaultDoc);
  app.delete("/api/vault/docs/:id", requireAuth, handleDeleteVaultDoc);
  app.get("/api/vault/keys", requireAuth, handleGetVaultKeys);
  app.post("/api/vault/keys", requireAuth, handleCreateVaultKeys);
  app.put("/api/vault/keys/password", requireAuth, handleUpdateVaultPassword);
  app.get("/api/vault/docs", requireAuth, handleListVaultDocs);
  app.post("/api/vault/docs", requireAuth, handleCreateVaultDoc);
  app.delete("/api/vault/docs/:id", requireAuth, handleDeleteVaultDoc);
  app.patch("/api/vault/docs/:id", requireAuth, handleRenameVaultDoc);
  app.get("/api/clinics/:clinicId/reviews", handleListClinicReviews);
  app.post("/api/clinics/:clinicId/reviews", handleCreateClinicReview);
  app.patch("/api/clinics/:clinicId/reviews/:reviewId", handleUpdateClinicReview);
  app.delete("/api/clinics/:clinicId/reviews/:reviewId", handleDeleteClinicReview);
  app.post("/api/translate", handleTranslate);
  app.get("/api/google-maps/geocode", handleGeocode);
  app.get("/api/google-maps/places/autocomplete", handlePlaceAutocomplete);
  app.get("/api/google-maps/places/details", handlePlaceDetails);
  app.use("/api/docdaisy", docDaisyRouter);
  app.use("/api/health", healthRouter);

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // console.error("Server Error:", err); // Optional: Enable for debugging

    if (err instanceof SyntaxError && "body" in err) {
      return res.status(400).json({
        error: "Malformed JSON in request body",
        detail: "invalid_json",
        hint: "Ensure the request body is valid JSON and the Content-Type header is set to application/json.",
      });
    }

    if (err.message === "Not allowed by CORS") {
       return res.status(403).json({
           error: "CORS Error",
           detail: "Origin not allowed"
       });
    }

    const status = typeof err?.status === "number" ? err.status : 500;
    return res.status(status).json({
      error: status === 500 ? "Unexpected server error" : err?.message ?? "Request failed",
      detail: err?.detail ?? "server_error",
    });
  });

  return app;
}
