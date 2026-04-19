import "dotenv/config";
import express, { Express, Request } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { handleDemo } from "./routes/demo";
import { handleAvailability } from "./routes/availability";
import {
  handleCancelAppointment,
  handleClinicCancelAppointment,
  handleClinicConfirmAppointment,
  handleClinicCompleteAppointment,
  handleClinicDeleteAppointment,
  handleClinicDeclineAppointment,
  handleClinicPatientDetails,
  handleClinicRescheduleMessage,
  handleConfirmAppointment,
  handleCreateAppointmentReview,
  handleDeclineAppointment,
  handleGetAppointmentReview,
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
import documentTranslateRouter from "./routes/document-translate";
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
import { handleVoiceAppointment, handleVoiceAppointmentResponse } from "./routes/voice";
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
  handleListCustomLabels,
  handlePatchClinicMe,
  handleUpdateClinicDoctors,
  handleUpdateClinicProfile,
} from "./routes/clinic";
import { requireClinicAuth } from "./middleware/clinic-auth";
import { requireAdminAuth } from "./middleware/admin-auth";
import { handleAdminAuthCheck, handleAdminAuditLogs, handleAdminClinicAccounts, handleAdminClinicList, handleAdminCreateClinic, handleAdminCreateCustomLabel, handleAdminDeleteClinic, handleAdminDeleteCustomLabel, handleAdminGetCallSettings, handleAdminListCustomLabels, handleAdminResetClinicPassword, handleAdminUpdateCallSettings, handleAdminUpdateClinic, handleAdminUpdateCustomLabel } from "./routes/admin";
import {
  handleGetProfile,
  handleRequestProfileEmailChangeOtp,
  handleRequestProfilePhoneChangeOtp,
  handleUpdateProfile,
  handleVerifyProfileEmailChangeOtp,
  handleVerifyProfilePhoneChangeOtp,
} from "./routes/profile";
import { handleTranslate } from "./routes/translate";

const WEAK_SECRET_VALUES = new Set(["dev-secret-change-me", "password", "changeme", "secret"]);

const isWeakSecret = (value: string, minLength: number) =>
  value.trim().length < minLength || WEAK_SECRET_VALUES.has(value.trim().toLowerCase());

const assertSecurityConfig = () => {
  const errors: string[] = [];

  const authJwtSecret = process.env.AUTH_JWT_SECRET ?? process.env.JWT_SECRET;
  const clinicJwtSecret = process.env.CLINIC_JWT_SECRET ?? authJwtSecret;
  const adminUsername = process.env.ADMIN_USERNAME ?? process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!authJwtSecret || isWeakSecret(authJwtSecret, 32)) {
    errors.push("Set AUTH_JWT_SECRET (or JWT_SECRET) to a strong secret (minimum 32 characters).");
  }

  if (!clinicJwtSecret || isWeakSecret(clinicJwtSecret, 32)) {
    errors.push("Set CLINIC_JWT_SECRET (or AUTH_JWT_SECRET) to a strong secret (minimum 32 characters).");
  }

  if (!adminUsername || adminUsername.trim().length < 3 || adminUsername.trim().toLowerCase() === "somebody") {
    errors.push("Set ADMIN_USERNAME (or ADMIN_EMAIL) to a non-default value.");
  }

  if (!adminPassword || isWeakSecret(adminPassword, 12)) {
    errors.push("Set ADMIN_PASSWORD to a strong secret (minimum 12 characters, non-default).");
  }

  if (errors.length > 0) {
    console.warn(`[security] Auth configuration warnings:\n- ${errors.join("\n- ")}`);
  }
};

export async function createServer(): Promise<Express> {
  const app = express();
  assertSecurityConfig();

  const isDev = process.env.NODE_ENV !== "production";

  // Netlify runs Express behind proxies and forwards the client IP via headers.
  app.set("trust proxy", true);

  const extractClientIp = (req: Request) => {
    const forwardedFor = req.headers["x-forwarded-for"];
    const forwardedForHeader = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    const forwardedIp =
      typeof forwardedForHeader === "string"
        ? forwardedForHeader.split(",")[0]?.trim()
        : "";
    const netlifyIpHeader = req.headers["x-nf-client-connection-ip"];
    const netlifyIp =
      typeof netlifyIpHeader === "string"
        ? netlifyIpHeader.trim()
        : Array.isArray(netlifyIpHeader)
          ? netlifyIpHeader[0]?.trim() ?? ""
          : "";
    const requestIp = typeof req.ip === "string" ? req.ip.trim() : "";
    const socketIp = req.socket?.remoteAddress?.trim() ?? "";

    return forwardedIp || netlifyIp || requestIp || socketIp || "unknown";
  };

  const sharedRateLimitOptions = {
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => extractClientIp(req),
  };

  // ── Security headers via Helmet ──
  app.use(
    helmet({
      contentSecurityPolicy: isDev
        ? false
        : {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "https://cloud.umami.is", "https://www.google.com", "https://www.gstatic.com"],
              styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
              fontSrc: ["'self'", "https://fonts.gstatic.com"],
              imgSrc: ["'self'", "data:", "blob:", "https:"],
              connectSrc: ["'self'", "https://cloud.umami.is", "https://maps.googleapis.com", "https://www.google.com"],
              frameSrc: ["'self'", "https://www.google.com"],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
            },
          },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  // ── Rate limiters ──
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300,
    ...sharedRateLimitOptions,
    message: { error: "Too many requests, please try again later.", detail: "rate_limited" },
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    ...sharedRateLimitOptions,
    message: { error: "Too many authentication attempts, please try again later.", detail: "rate_limited" },
  });

  const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    ...sharedRateLimitOptions,
    message: { error: "Too many OTP requests, please try again later.", detail: "rate_limited" },
  });

  const otpVerifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    ...sharedRateLimitOptions,
    message: { error: "Too many verification attempts, please try again later.", detail: "rate_limited" },
  });

  const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    ...sharedRateLimitOptions,
    message: { error: "Too many admin requests, please try again later.", detail: "rate_limited" },
  });

  // Apply global rate limiter to all /api routes
  app.use("/api/", globalLimiter);

  // ── CORS ──
  const allowedOrigins: string[] = [
    process.env.VOICE_WEBHOOK_BASE_URL,
    "https://docnearme.jp",
    "https://www.docnearme.jp",
    "https://admin.docnearme.jp",
    "https://www.admin.docnearme.jp",
    "https://clinic.docnearme.jp",
    "https://www.clinic.docnearme.jp",
    "https://docnearme.app",
    "https://www.docnearme.app",
    "https://admin.docnearme.app",
    "https://www.admin.docnearme.app",
    "https://clinic.docnearme.app",
    "https://www.clinic.docnearme.app",
    "https://clinics.docnearme.app",
  ].filter(Boolean) as string[];
  // Only allow localhost origins in development
  if (isDev) {
    allowedOrigins.push(
      "http://localhost:5173",
      "http://localhost:3000",
      "http://0.0.0.0:3000",
      "http://127.0.0.1:3000",
    );
  }
  const allowedOriginSet = new Set(allowedOrigins);
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
  app.use(express.urlencoded({
    extended: true,
    verify: (req, _res, buf) => {
      (req as any)._rawBody = buf.toString("utf8");
    },
  }));
  app.use(express.json({
    type: ["application/json", "application/*+json", "text/json"],
    limit: "10mb",
    verify: (req, _res, buf) => {
      (req as any)._rawBody = buf.toString("utf8");
    },
  }));


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
  // GET state-changing routes removed for security — confirm/decline require POST
  app.get("/api/appointments", requireAdminAuth, handleListAppointments);
  app.get("/api/appointments/me", requireAuth, handleListAppointmentsForUser);
  app.get("/api/clinic/appointments", requireClinicAuth, handleListAppointmentsForClinic);
  app.get("/api/clinic/appointments/:id/patient", requireClinicAuth, handleClinicPatientDetails);
  app.post("/api/clinic/appointments/:id/cancel", requireClinicAuth, handleClinicCancelAppointment);
  app.post("/api/clinic/appointments/:id/confirm", requireClinicAuth, handleClinicConfirmAppointment);
  app.post("/api/clinic/appointments/:id/decline", requireClinicAuth, handleClinicDeclineAppointment);
  app.post("/api/clinic/appointments/:id/complete", requireClinicAuth, handleClinicCompleteAppointment);
  app.post("/api/clinic/appointments/:id/reschedule-message", requireClinicAuth, handleClinicRescheduleMessage);
  app.delete("/api/clinic/appointments/:id", requireClinicAuth, handleClinicDeleteAppointment);
    app.get("/api/appointments/:id/review", requireAuth, handleGetAppointmentReview);
    app.post("/api/appointments/:id/review", requireAuth, handleCreateAppointmentReview);
  app.get("/api/clinic/intake-form", requireClinicAuth, handleGetClinicIntakeFormForClinic);
  app.put("/api/clinic/intake-form", requireClinicAuth, handleUpdateClinicIntakeForm);
  app.get("/api/clinic/me", requireClinicAuth, handleClinicMe);
  app.patch("/api/clinic/me", requireClinicAuth, handlePatchClinicMe);
  app.post("/api/clinic/me/closures", requireClinicAuth, handleAddClinicClosure);
  app.delete("/api/clinic/me/closures/:closureId", requireClinicAuth, handleDeleteClinicClosure);
  app.post("/api/auth/signup", authLimiter, handleSignup);
  app.post("/api/auth/login", authLimiter, handleLogin);
  app.post("/api/auth/check-email", authLimiter, handleCheckEmail);
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
  app.post("/api/auth/request-otp", otpLimiter, handleRequestOtp);
  app.post("/api/auth/verify-otp", otpVerifyLimiter, handleVerifyOtp);
  app.post("/api/auth/request-phone-otp", otpLimiter, handleRequestPhoneOtp);
  app.post("/api/auth/verify-phone-otp", otpVerifyLimiter, handleVerifyPhoneOtp);
  app.post("/api/auth/request-password-reset", otpLimiter, handleRequestPasswordReset);
  app.post("/api/auth/reset-password", otpVerifyLimiter, handleResetPassword);
  app.get("/api/profile", requireAuth, handleGetProfile);
  app.post("/api/profile/email-change/request", requireAuth, otpLimiter, handleRequestProfileEmailChangeOtp);
  app.post("/api/profile/email-change/verify", requireAuth, otpVerifyLimiter, handleVerifyProfileEmailChangeOtp);
  app.post("/api/profile/phone-change/request", requireAuth, otpLimiter, handleRequestProfilePhoneChangeOtp);
  app.post("/api/profile/phone-change/verify", requireAuth, otpVerifyLimiter, handleVerifyProfilePhoneChangeOtp);
  app.put("/api/profile", requireAuth, handleUpdateProfile);
  app.post("/api/clinic-auth/login", authLimiter, handleClinicLogin);
  app.get("/api/clinic-credentials", requireAdminAuth, handleClinicCredentials);
  app.get("/api/admin/auth-check", adminLimiter, handleAdminAuthCheck);
  app.post("/api/admin/auth-check", adminLimiter, handleAdminAuthCheck);
  app.get("/api/admin/clinics", adminLimiter, requireAdminAuth, handleAdminClinicList);
  app.post("/api/admin/clinics", adminLimiter, requireAdminAuth, handleAdminCreateClinic);
  app.patch("/api/admin/clinics/:id", adminLimiter, requireAdminAuth, handleAdminUpdateClinic);
  app.delete("/api/admin/clinics/:id", adminLimiter, requireAdminAuth, handleAdminDeleteClinic);
  app.get("/api/admin/accounts", adminLimiter, requireAdminAuth, handleAdminClinicAccounts);
  app.post("/api/admin/clinics/:id/reset-password", adminLimiter, requireAdminAuth, handleAdminResetClinicPassword);
  app.get("/api/admin/logs", adminLimiter, requireAdminAuth, handleAdminAuditLogs);
  app.get("/api/admin/call-settings", adminLimiter, requireAdminAuth, handleAdminGetCallSettings);
  app.patch("/api/admin/call-settings", adminLimiter, requireAdminAuth, handleAdminUpdateCallSettings);
  app.get("/api/admin/labels", adminLimiter, requireAdminAuth, handleAdminListCustomLabels);
  app.post("/api/admin/labels", adminLimiter, requireAdminAuth, handleAdminCreateCustomLabel);
  app.patch("/api/admin/labels/:labelId", adminLimiter, requireAdminAuth, handleAdminUpdateCustomLabel);
  app.delete("/api/admin/labels/:labelId", adminLimiter, requireAdminAuth, handleAdminDeleteCustomLabel);
  app.get("/api/clinics", handleClinicList);
  app.get("/api/labels", handleListCustomLabels);
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
  app.post("/api/voice/appointment", handleVoiceAppointment);
  app.post("/api/voice/appointment/response", handleVoiceAppointmentResponse);
  app.get("/api/clinics/:clinicId/reviews", handleListClinicReviews);
  app.post("/api/clinics/:clinicId/reviews", requireAuth, handleCreateClinicReview);
  app.patch("/api/clinics/:clinicId/reviews/:reviewId", requireAuth, handleUpdateClinicReview);
  app.delete("/api/clinics/:clinicId/reviews/:reviewId", requireAuth, handleDeleteClinicReview);
  app.post("/api/translate", handleTranslate);
  app.get("/api/google-maps/geocode", handleGeocode);
  app.get("/api/google-maps/places/autocomplete", handlePlaceAutocomplete);
  app.get("/api/google-maps/places/details", handlePlaceDetails);
  app.use("/api/docdaisy", docDaisyRouter);
  app.use("/api/clinic/documents", requireClinicAuth, documentTranslateRouter);
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
