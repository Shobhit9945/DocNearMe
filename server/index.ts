import "dotenv/config";
import express, { Express } from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleAvailability } from "./routes/availability";
import { handleCreateAppointment, handleListAppointments } from "./routes/appointment";
import docDaisyRouter from "./routes/docdaisy";
import healthRouter from "./routes/health";
import { handleLogin, handleSignup } from "./routes/auth";

export async function createServer(): Promise<Express> {
  const app = express();

  // Middleware
  const allowedOrigins = ["https://docnearby.netlify.app", "http://localhost:5173"];
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
  app.use(express.json({ type: "*/*", limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));


  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);
  app.get("/api/availability", handleAvailability);
  app.post("/api/appointments", handleCreateAppointment);
  app.get("/api/appointments", handleListAppointments);
  app.post("/api/auth/signup", handleSignup);
  app.post("/api/auth/login", handleLogin);
  app.use("/api/docdaisy", docDaisyRouter);
  app.use("/api/health", healthRouter);

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof SyntaxError && "body" in err) {
      return res.status(400).json({
        error: "Malformed JSON in request body",
        detail: "invalid_json",
        hint: "Ensure the request body is valid JSON and the Content-Type header is set to application/json.",
      });
    }

    const status = typeof err?.status === "number" ? err.status : 500;
    return res.status(status).json({
      error: status === 500 ? "Unexpected server error" : err?.message ?? "Request failed",
      detail: err?.detail ?? "server_error",
    });
  });

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof SyntaxError && "body" in err) {
      return res.status(400).json({
        error: "Malformed JSON in request body",
        detail: "invalid_json",
        hint: "Ensure the request body is valid JSON and the Content-Type header is set to application/json.",
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
