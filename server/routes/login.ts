import { RequestHandler } from "express";
import { MongoClient } from "mongodb";
import { z } from "zod";
import bcrypt from "bcryptjs";

const getMongoUri = () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is not set");
  }
  return mongoUri;
};

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  role: z.enum(["patient", "clinic"]),
});

let cachedClient: MongoClient | null = null;

async function getMongoClient(): Promise<MongoClient> {
  if (cachedClient) {
    return cachedClient;
  }
  const client = new MongoClient(getMongoUri());
  await client.connect();
  cachedClient = client;
  return client;
}

export const handleLogin: RequestHandler = async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid login payload",
      detail: parsed.error.flatten(),
    });
  }

  try {
    if (!process.env.MONGODB_URI) {
      return res.status(500).json({
        error: "Database connection is not configured",
        detail: "missing_mongodb_uri",
        hint: "Set MONGODB_URI in the environment variables for the deployed function.",
      });
    }
    const client = await getMongoClient();
    const db = client.db("docnearme");
    const users = db.collection<{
      email: string;
      role: "patient" | "clinic";
      password?: string;
      passwordHash?: string;
      name?: string;
    }>("users");

    const email = parsed.data.email.trim().toLowerCase();
    const role = parsed.data.role;

    const user = await users.findOne({ email, role });

    if (!user) {
      return res.status(401).json({
        error: "Invalid email or role",
        detail: "user_not_found",
      });
    }

    if (!user.passwordHash) {
      return res.status(500).json({
        error: "Account missing password hash (contact admin).",
        detail: "missing_password_hash",
      });
    }

    const passwordMatches = await bcrypt.compare(parsed.data.password, user.passwordHash);

    if (!passwordMatches) {
      return res.status(401).json({
        error: "Invalid credentials",
        detail: "password_mismatch",
      });
    }

    return res.json({
      ok: true,
      role: user.role,
      name: user.name ?? user.email,
      redirectTo: user.role === "clinic" ? "/clinic" : "/",
    });
  } catch (error) {
    return res.status(500).json({
      error: "Unable to complete login",
      detail: error instanceof Error ? error.message : "unknown_error",
    });
  }
};
