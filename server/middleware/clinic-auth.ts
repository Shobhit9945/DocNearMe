import { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { getClinicAccountsCollection } from "../db";

export type ClinicAuthContext = {
  clinicId: string;
  userId: string;
};

type ClinicTokenPayload = {
  sub?: string;
  clinicId?: string;
  userId?: string;
};

const getClinicJwtSecret = () =>
  process.env.CLINIC_JWT_SECRET ?? process.env.AUTH_JWT_SECRET ?? process.env.JWT_SECRET;

export const requireClinicAuth: RequestHandler = async (req, res, next) => {
  const jwtSecret = getClinicJwtSecret();
  if (!jwtSecret || jwtSecret === "dev-secret-change-me") {
    return res.status(500).json({
      error: "Clinic authentication service is not configured.",
      detail: "clinic_auth_misconfigured",
    });
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Authentication required.",
      detail: "missing_token",
    });
  }

  const token = header.replace("Bearer", "").trim();
  if (!token) {
    return res.status(401).json({
      error: "Authentication required.",
      detail: "missing_token",
    });
  }

  try {
    const payload = jwt.verify(token, jwtSecret) as ClinicTokenPayload;
    const userId = payload.sub ?? payload.userId ?? "";
    const clinicId = payload.clinicId ?? "";
    if (!userId || !clinicId) {
      return res.status(401).json({
        error: "Invalid authentication token.",
        detail: "invalid_token",
      });
    }

    const accounts = await getClinicAccountsCollection();
    const account = await accounts.findOne({ userId, clinicId });
    if (!account) {
      return res.status(401).json({
        error: "Invalid authentication token.",
        detail: "user_not_found",
      });
    }

    req.clinicAuth = {
      clinicId,
      userId,
    };

    return next();
  } catch (error) {
    return res.status(401).json({
      error: "Invalid authentication token.",
      detail: "invalid_token",
    });
  }
};

declare module "express-serve-static-core" {
  interface Request {
    clinicAuth?: ClinicAuthContext;
  }
}
