import { RequestHandler } from "express";

export type AdminAuthContext = {
  username: string;
};

const adminUsername =
  process.env.ADMIN_USERNAME ?? process.env.ADMIN_EMAIL ?? "somebody";
const adminPassword = process.env.ADMIN_PASSWORD ?? "password";

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
  const parsed = parseBasicAuth(req.header("Authorization"));
  if (!parsed || parsed.username !== adminUsername || parsed.password !== adminPassword) {
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
