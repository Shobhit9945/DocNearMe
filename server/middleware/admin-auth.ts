import { RequestHandler } from "express";
import crypto from "crypto";

export type AdminAuthContext = {
  username: string;
};

const getAdminCredentials = () => {
  const username = process.env.ADMIN_USERNAME ?? process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return null;
  return { username, password };
};

const safeEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const parseBasicAuth = (header?: string) => {
  if (!header) return null;
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) return null;
  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex === -1) return null;
    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
};

export const requireAdminAuth: RequestHandler = (req, res, next) => {
  const configured = getAdminCredentials();
  if (!configured) {
    return res.status(500).json({ error: "Admin authentication is not configured." });
  }

  const parsed = parseBasicAuth(req.header("Authorization"));
  if (
    !parsed ||
    !safeEqual(parsed.username, configured.username) ||
    !safeEqual(parsed.password, configured.password)
  ) {
    res.setHeader("WWW-Authenticate", "Basic");
    return res.status(401).json({ error: "Invalid admin credentials." });
  }
  req.adminAuth = {
    username: parsed.username,
  };
  return next();
};

declare module "express-serve-static-core" {
  interface Request {
    adminAuth?: AdminAuthContext;
  }
}
