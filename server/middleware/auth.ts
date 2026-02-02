import { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { getPatientsCollection } from "../db";

export type AuthContext = {
  id: string;
  email: string;
  name: string;
};

type AuthTokenPayload = {
  sub?: string;
  email?: string;
  name?: string;
};

const jwtSecret = process.env.AUTH_JWT_SECRET ?? process.env.JWT_SECRET ?? "dev-secret-change-me";

export const requireAuth: RequestHandler = async (req, res, next) => {
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
    const payload = jwt.verify(token, jwtSecret) as AuthTokenPayload;
    const userId = payload.sub ? String(payload.sub) : "";
    if (!userId) {
      return res.status(401).json({
        error: "Invalid authentication token.",
        detail: "invalid_token",
      });
    }

    const patients = await getPatientsCollection();
    const lookupId = ObjectId.isValid(userId) ? new ObjectId(userId) : userId;
    const user = await patients.findOne({ _id: lookupId });
    if (!user) {
      return res.status(401).json({
        error: "Invalid authentication token.",
        detail: "user_not_found",
      });
    }

    req.auth = {
      id: userId,
      email: user.email,
      name: user.name,
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
    auth?: AuthContext;
  }
}
