import { Router } from "express";
import { ObjectId } from "mongodb";
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

router.post("/patient/signup", async (req, res) => {
  const parsed = patientSignupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
  }

  const { email, name, password } = parsed.data;

  try {
    const users = await getUsersCollection();
    const existing = await users.findOne({ email });

    if (existing) {
      return res.status(409).json({ error: "An account already exists with this email" });
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
    return res.status(500).json({ error: "Failed to create account" });
  }
});

router.post("/patient/login", async (req, res) => {
  const parsed = patientLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
  }

  const { email, password } = parsed.data;

  try {
    const users = await getUsersCollection();
    const user = await users.findOne<User>({ email, role: "patient" });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" });
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
    return res.status(500).json({ error: "Failed to login" });
  }
});

router.post("/admin/login", async (req, res) => {
  const parsed = adminLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
  }

  const { email, password } = parsed.data;

  try {
    const users = await getUsersCollection();
    const user = await users.findOne<User>({ email, role: "admin" });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" });
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
    return res.status(500).json({ error: "Failed to login" });
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
    return res.status(500).json({ error: "Failed to fetch user" });
  }
});

export default router;
