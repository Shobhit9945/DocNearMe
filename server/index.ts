import "dotenv/config";
import express, { Express } from "express";
import cors from "cors";
import { connectToDatabase } from "./db";
import { handleDemo } from "./routes/demo";
import { handleAvailability } from "./routes/availability";
import { handleCreateAppointment, handleListAppointments } from "./routes/appointment";
import docDaisyRouter from "./routes/docdaisy";
import authRouter from "./routes/auth";
import healthRouter from "./routes/health";
import { authenticate, requireRole } from "./middleware/auth";

export async function createServer(): Promise<Express> {
  await connectToDatabase();

  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Netlify rewrites can drop the content-type header, which prevents
  // express.json from parsing the body. Accept text payloads when no content
  // type is present and opportunistically decode JSON strings so auth routes
  // still receive the expected object payloads.
  app.use(
    express.text({
      type: (req) => {
        const contentType = req.headers["content-type"];
        return !contentType || contentType.startsWith("text/");
      },
      limit: "1mb",
    }),
  );
  app.use((req, _res, next) => {
    if (typeof req.body === "string" && req.body.trim()) {
      try {
        req.body = JSON.parse(req.body);
      } catch {
        // Leave the original string body intact if it's not valid JSON.
      }
    }
    next();
  });

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);
  app.get("/api/availability", handleAvailability);
  app.post("/api/appointments", authenticate, requireRole(["patient"]), handleCreateAppointment);
  app.get("/api/appointments", authenticate, ...handleListAppointments);

  app.use("/api/auth", authRouter);
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
