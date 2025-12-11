import "dotenv/config";
import express, { Express } from "express";
import cors from "cors";
import { connectToDatabase } from "./db";
import { handleDemo } from "./routes/demo";
import { handleAvailability } from "./routes/availability";
import { handleCreateAppointment, handleListAppointments } from "./routes/appointment";
import docDaisyRouter from "./routes/docdaisy";
import authRouter from "./routes/auth";
import { authenticate, requireRole } from "./middleware/auth";

export async function createServer(): Promise<Express> {
  await connectToDatabase();

  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

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

  return app;
}
