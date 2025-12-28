import { Router } from "express";
import crypto from "crypto";
import { MongoServerSelectionError, ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getUsersCollection } from "../db";
import { authenticate, signToken, AuthenticatedRequest } from "../middleware/auth";
import { User } from "../types";

const router = Router();

const patientSignupSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const patientLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type ErrorPayload = {
  error: string;
  detail?: string;
  hint?: string;
  traceId?: string;
  issues?: string[];
};

const generateTraceId = () => crypto.randomUUID?.() ?? `trace-${Date.now()}`;

const respondWithBodyParseHint = (res: any) =>
  res.status(400).json({
    error: "Request body was not parsed. Send JSON with the expected fields.",
    detail: "body_not_parsed",
    hint: "On Netlify, make sure your rewrite targets /.netlify/functions/api and preserves the Content-Type: application/json header.",
  } satisfies ErrorPayload);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const respondWithValidationError = (res: any, issues: string[], fallback = "Invalid input") =>
  res.status(400).json({
    error: issues[0] ?? fallback,
    detail: "validation",
    issues,
  } satisfies ErrorPayload);

const mapAuthError = (error: unknown, action: "signup" | "login" | "fetch-user") => {
  const traceId = generateTraceId();

  if (error instanceof MongoServerSelectionError) {
    return {
      status: 503,
      payload: {
        error: `Unable to ${action}: database connection failed`,
        detail: "mongo_connection",
        hint: "Verify MONGODB_URI credentials and that the cluster allows connections from the Netlify function region.",
        traceId,
      } satisfies ErrorPayload,
    } as const;
  }

  if (error instanceof Error && /ECONNREFUSED|ENOTFOUND|timed out/i.test(error.message)) {
    return {
      status: 503,
      payload: {
        error: `Unable to ${action}: upstream service unreachable`,
        detail: "network",
        hint: "Check network access between Netlify Functions and MongoDB.",
        traceId,
      } satisfies ErrorPayload,
    } as const;
  }

  return {
    status: 500,
    payload: {
      error: `Failed to ${action}`,
      detail: "unknown",
      hint: "Check Netlify function logs for the trace ID provided.",
      traceId,
    } satisfies ErrorPayload,
  } as const;
};

router.post("/patient/signup", async (req, res) => {
  if (!isPlainObject(req.body)) {
    return respondWithBodyParseHint(res);
  }

  const parsed = patientSignupSchema.safeParse(req.body);
  if (!parsed.success) {
    return respondWithValidationError(
      res,
      parsed.error.errors.map((err) => err.message)
    );
  }

  const { email, name, password } = parsed.data;

  try {
    const users = await getUsersCollection();
    const existing = await users.findOne({ email });

    if (existing) {
      return res.status(409).json({
        error: "An account already exists with this email",
        detail: "account_exists",
        hint: "Try logging in instead or reset your password.",
      } satisfies ErrorPayload);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date();
    const insertResult = await users.insertOne({
      email,
      name,
      passwordHash,
      role: "patient",
      createdAt: now,
    });

    const token = signToken({ userId: insertResult.insertedId.toString(), role: "patient" });

    return res.status(201).json({
      token,
      user: {
        id: insertResult.insertedId.toString(),
        email,
        name,
        role: "patient" as const,
      },
    });
  } catch (error) {
    console.error("Patient signup error", error);
    const { status, payload } = mapAuthError(error, "signup");
    return res.status(status).json(payload);
  }
});

router.post("/patient/login", async (req, res) => {
  if (!isPlainObject(req.body)) {
    return respondWithBodyParseHint(res);
  }

  const parsed = patientLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return respondWithValidationError(
      res,
      parsed.error.errors.map((err) => err.message)
    );
  }

  const { email, password } = parsed.data;

  try {
    const users = await getUsersCollection();
    const user = await users.findOne<User>({ email, role: "patient" });

    if (!user) {
      return res.status(401).json({
        error: "Invalid credentials",
        detail: "invalid_credentials",
        hint: "Check your email and password, or create a patient account first.",
      } satisfies ErrorPayload);
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      return res.status(401).json({
        error: "Invalid credentials",
        detail: "invalid_credentials",
        hint: "Check your email and password, or reset your password.",
      } satisfies ErrorPayload);
    }

    const token = signToken({ userId: (user._id as ObjectId).toString(), role: "patient" });

    return res.json({
      token,
      user: {
        id: (user._id as ObjectId).toString(),
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Patient login error", error);
    const { status, payload } = mapAuthError(error, "login");
    return res.status(status).json(payload);
  }
});

router.post("/admin/login", async (req, res) => {
  if (!isPlainObject(req.body)) {
    return respondWithBodyParseHint(res);
  }

  const parsed = adminLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return respondWithValidationError(
      res,
      parsed.error.errors.map((err) => err.message)
    );
  }

  const { email, password } = parsed.data;

  try {
    const users = await getUsersCollection();
    const user = await users.findOne<User>({ email, role: "admin" });

    if (!user) {
      return res.status(401).json({
        error: "Invalid credentials",
        detail: "invalid_credentials",
        hint: "Confirm the admin credentials configured in the server environment.",
      } satisfies ErrorPayload);
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      return res.status(401).json({
        error: "Invalid credentials",
        detail: "invalid_credentials",
        hint: "Confirm the admin credentials configured in the server environment.",
      } satisfies ErrorPayload);
    }

    const token = signToken({
      userId: (user._id as ObjectId).toString(),
      role: "admin",
      clinicId: user.clinicId,
    });

    return res.json({
      token,
      user: {
        id: (user._id as ObjectId).toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        clinicId: user.clinicId,
      },
    });
  } catch (error) {
    console.error("Admin login error", error);
    const { status, payload } = mapAuthError(error, "login");
    return res.status(status).json(payload);
  }
});

router.get("/me", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const users = await getUsersCollection();
    const userId = req.user!.userId;
    const user = await users.findOne<User>({ _id: new ObjectId(userId) });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      user: {
        id: (user._id as ObjectId).toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        clinicId: user.clinicId,
      },
    });
  } catch (error) {
    console.error("Fetch current user error", error);
    const { status, payload } = mapAuthError(error, "fetch-user");
    return res.status(status).json(payload);
  }
});

export default router;
