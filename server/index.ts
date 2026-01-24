import "dotenv/config";
import express, { Express } from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleAvailability } from "./routes/availability";
import {
  handleCancelAppointment,
  handleConfirmAppointment,
  handleDeclineAppointment,
  handleListAppointments,
  handleListAppointmentsForUser,
  handleRequestAppointment,
  handleRescheduleAppointment,
} from "./routes/appointment";
import docDaisyRouter from "./routes/docdaisy";
import healthRouter from "./routes/health";
import {
  handleLogin,
  handleCheckEmail,
  handleRequestOtp,
  handleRequestPasswordReset,
  handleResetPassword,
  handleSignup,
  handleVerifyOtp,
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
import { handleGeocode, handlePlaceAutocomplete, handlePlaceDetails } from "./routes/google-maps";
import {
  handleClinicCredentials,
  handleClinicDoctors,
  handleClinicDoctorsAll,
  handleClinicList,
  handleClinicLogin,
  handleClinicProfile,
  handleUpdateClinicDoctors,
  handleUpdateClinicProfile,
} from "./routes/clinic";
import { requireClinicAuth } from "./middleware/clinic-auth";

export async function createServer(): Promise<Express> {
  const app = express();

  // Middleware
  const allowedOrigins = [
    "https://docnearby.netlify.app", 
    "https://docnearme.jp",
    "https://www.docnearme.jp",
    "https://clinic.docnearme.jp",
    "http://localhost:5173", 
    "http://localhost:3000",
    "http://0.0.0.0:3000",
    "http://127.0.0.1:3000"
  ];
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
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
  app.get("/api/appointments", handleListAppointments);
  app.get("/api/appointments/me", requireAuth, handleListAppointmentsForUser);
  app.post("/api/auth/signup", handleSignup);
  app.post("/api/auth/login", handleLogin);
  app.post("/api/auth/check-email", handleCheckEmail);
  app.post("/api/auth/request-otp", handleRequestOtp);
  app.post("/api/auth/verify-otp", handleVerifyOtp);
  app.post("/api/auth/request-password-reset", handleRequestPasswordReset);
  app.post("/api/auth/reset-password", handleResetPassword);
  app.post("/api/clinic-auth/login", handleClinicLogin);
  app.get("/api/clinic-credentials", handleClinicCredentials);
  app.get("/api/clinics", handleClinicList);
  app.get("/api/clinics/doctors", handleClinicDoctorsAll);
  app.get("/api/clinics/:clinicId", handleClinicProfile);
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
  app.get("/api/clinics/:clinicId/reviews", handleListClinicReviews);
  app.post("/api/clinics/:clinicId/reviews", handleCreateClinicReview);
  app.patch("/api/clinics/:clinicId/reviews/:reviewId", handleUpdateClinicReview);
  app.delete("/api/clinics/:clinicId/reviews/:reviewId", handleDeleteClinicReview);
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
