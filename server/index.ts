import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleAvailability } from "./routes/availability";
import { handleCreateAppointment } from "./routes/appointment";
import docDaisyRouter from "./routes/docdaisy";

export function createServer() {
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
  app.post("/api/appointments", handleCreateAppointment);

  app.use("/api/docdaisy", docDaisyRouter);

  return app;
}
