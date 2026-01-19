import { RequestHandler } from "express";
import { z } from "zod";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { getPatientsCollection } from "../db";
import { PatientUser } from "../types";
import { AuthResponse, LoginRequest, SignupRequest } from "@shared/api";

const emailSchema = z.string().trim().toLowerCase().email().max(254);
const passwordSchema = z.string().min(8).max(128);
const nameSchema = z.string().trim().min(2).max(80);

const signupSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

const jwtSecret = process.env.AUTH_JWT_SECRET ?? process.env.JWT_SECRET ?? "dev-secret-change-me";
const jwtExpiry = process.env.AUTH_JWT_EXPIRES_IN ?? "7d";

const getUserId = (user: PatientUser) => {
  if (user._id instanceof ObjectId) return user._id.toString();
  return String(user._id ?? "");
};

const toAuthResponse = (user: PatientUser): AuthResponse["user"] => ({
  id: getUserId(user),
  name: user.name,
  email: user.email,
  createdAt: new Date(user.createdAt).toISOString(),
});

const signToken = (user: PatientUser) =>
  jwt.sign(
    {
      sub: getUserId(user),
      email: user.email,
      name: user.name,
    },
    jwtSecret,
    { expiresIn: jwtExpiry },
  );

export const handleSignup: RequestHandler = async (req, res, next) => {
  try {
    const payload = signupSchema.parse(req.body) as SignupRequest;
    const patients = await getPatientsCollection();
    const normalizedEmail = payload.email.toLowerCase();

    const existing = await patients.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({
        error: "An account with that email already exists.",
        detail: "email_exists",
      });
    }

    const passwordHash = await bcryptjs.hash(payload.password, 12);
    const user: PatientUser = {
      name: payload.name,
      email: normalizedEmail,
      passwordHash,
      createdAt: new Date(),
    };

    const result = await patients.insertOne(user);
    const userWithId: PatientUser = { ...user, _id: result.insertedId };
    const token = signToken(userWithId);

    const response: AuthResponse = {
      token,
      user: toAuthResponse(userWithId),
    };

    return res.status(201).json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.issues.map(issue => {
        const path = issue.path.join(".");
        return `${path}: ${issue.message}`;
      }).join(", ");

      return res.status(400).json({
        error: `Invalid signup data: ${messages}`,
        detail: "invalid_payload",
        issues: error.issues,
      });
    }
    return next(error);
  }
};

export const handleLogin: RequestHandler = async (req, res, next) => {
  try {
    const payload = loginSchema.parse(req.body) as LoginRequest;
    const patients = await getPatientsCollection();
    const normalizedEmail = payload.email.toLowerCase();

    const existing = await patients.findOne({ email: normalizedEmail });
    if (!existing) {
      return res.status(401).json({
        error: "Invalid email or password.",
        detail: "invalid_credentials",
      });
    }

    const passwordOk = await bcryptjs.compare(payload.password, existing.passwordHash);
    if (!passwordOk) {
      return res.status(401).json({
        error: "Invalid email or password.",
        detail: "invalid_credentials",
      });
    }

    const token = signToken(existing);
    const response: AuthResponse = {
      token,
      user: toAuthResponse(existing),
    };

    return res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid login payload.",
        detail: "invalid_payload",
        issues: error.issues,
      });
    }
    return next(error);
  }
};
