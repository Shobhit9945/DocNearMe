import { RequestHandler } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { connectToDatabase, isMemoryDb } from "../db";
import { User } from "../types";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["patient", "clinic"]),
  fullName: z.string().min(1),
});

const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const getUsersCollection = async () => {
  const db = await connectToDatabase();
  return isMemoryDb(db) ? db.collections.users : db.collection<User>("users");
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const toUserPayload = (user: User & { _id?: unknown }) => ({
  id: user._id?.toString?.() ?? String(user._id ?? ""),
  email: user.email,
  role: user.role,
  fullName: user.fullName,
});

const createToken = (userId: string, role: string) => {
  const secret = process.env.JWT_SECRET ?? "dev-secret";
  return jwt.sign({ sub: userId, role }, secret, { expiresIn: "7d" });
};

export const handleSignup: RequestHandler = async (req, res, next) => {
  try {
    const result = signupSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid signup payload" });
    }

    const { email, password, role, fullName } = result.data;
    const users = await getUsersCollection();
    const normalizedEmail = normalizeEmail(email);

    const existing = await users.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ error: "Account already exists for this email." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const createdAt = new Date();
    const { insertedId } = await users.insertOne({
      email: normalizedEmail,
      passwordHash,
      role,
      fullName,
      createdAt,
    });

    const userPayload = toUserPayload({
      _id: insertedId,
      email: normalizedEmail,
      role,
      fullName,
      passwordHash,
      createdAt,
    });
    const token = createToken(userPayload.id, role);
    return res.status(201).json({ user: userPayload, token });
  } catch (error) {
    return next(error);
  }
};

export const handleSignin: RequestHandler = async (req, res, next) => {
  try {
    const result = signinSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid sign-in payload" });
    }

    const { email, password } = result.data;
    const users = await getUsersCollection();
    const normalizedEmail = normalizeEmail(email);
    const existing = await users.findOne({ email: normalizedEmail });

    if (!existing) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const match = await bcrypt.compare(password, existing.passwordHash);
    if (!match) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const userPayload = toUserPayload(existing);
    const token = createToken(userPayload.id, existing.role);
    return res.status(200).json({ user: userPayload, token });
  } catch (error) {
    return next(error);
  }
};
