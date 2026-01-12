import { RequestHandler } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getUsersCollection } from "../db";
import { AuthResponse, AuthUser, UserRole } from "@shared/api";

const roleSchema = z.enum(["patient", "clinic"]);

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: roleSchema,
  fullName: z.string().min(1),
});

const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const authSecret = process.env.AUTH_JWT_SECRET ?? "dev-docnearme-secret";

const toAuthUser = (user: {
  _id?: ObjectId | string;
  email: string;
  role: UserRole;
  fullName: string;
}): AuthUser => ({
  id: user._id?.toString() ?? "",
  email: user.email,
  role: user.role,
  fullName: user.fullName,
});

const issueToken = (user: AuthUser) =>
  jwt.sign({ sub: user.id, role: user.role, email: user.email }, authSecret, { expiresIn: "7d" });

export const handleSignup: RequestHandler = async (req, res, next) => {
  try {
    const payload = signupSchema.parse(req.body);
    const users = await getUsersCollection();
    const email = payload.email.trim().toLowerCase();

    const existing = await users.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: "Email already in use." });
    }

    const passwordHash = await bcrypt.hash(payload.password, 12);
    const now = new Date();

    const result = await users.insertOne({
      email,
      passwordHash,
      role: payload.role,
      fullName: payload.fullName,
      createdAt: now,
    });

    const user = toAuthUser({
      _id: result.insertedId,
      email,
      role: payload.role,
      fullName: payload.fullName,
    });
    const response: AuthResponse = {
      token: issueToken(user),
      user,
    };

    return res.status(201).json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid signup payload.", issues: error.flatten().fieldErrors });
    }
    return next(error);
  }
};

export const handleSignin: RequestHandler = async (req, res, next) => {
  try {
    const payload = signinSchema.parse(req.body);
    const users = await getUsersCollection();
    const email = payload.email.trim().toLowerCase();

    const userRecord = await users.findOne({ email });
    if (!userRecord) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const isMatch = await bcrypt.compare(payload.password, userRecord.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const user = toAuthUser(userRecord);
    const response: AuthResponse = {
      token: issueToken(user),
      user,
    };

    return res.status(200).json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid signin payload.", issues: error.flatten().fieldErrors });
    }
    return next(error);
  }
};
