import { RequestHandler } from "express";
import { MongoClient } from "mongodb";
import { z } from "zod";
import bcrypt from "bcryptjs";

const mongoUri =
  process.env.MONGODB_URI ??
  "mongodb+srv://dnm_admin:MvsZctHg3oDjoALa@docnearme.qqhwmtb.mongodb.net/?appName=docnearme";

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
  const client = new MongoClient(mongoUri);
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
    const client = await getMongoClient();
    const db = client.db("docnearme");
    const users = db.collection<{
      email: string;
      role: "patient" | "clinic";
      password?: string;
      passwordHash?: string;
      name?: string;
    }>("users");

    const user = await users.findOne({
      email: parsed.data.email,
      role: parsed.data.role,
    });

    if (!user) {
      return res.status(401).json({
        error: "Invalid email or role",
        detail: "user_not_found",
      });
    }

    const passwordMatches = user.passwordHash
      ? await bcrypt.compare(parsed.data.password, user.passwordHash)
      : user.password === parsed.data.password;

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
