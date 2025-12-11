// server/db.ts
import "dotenv/config";
import bcrypt from "bcryptjs";
import { MongoClient, Db, Collection } from "mongodb";
import { User, Appointment } from "./types";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME ?? "docnearme";
const adminEmail = process.env.ADMIN_EMAIL ?? "admin@docnearme.local";
const adminPassword = process.env.ADMIN_PASSWORD ?? "ChangeMeNow123!";

if (!uri) {
  throw new Error("MONGODB_URI environment variable is required.");
}

// ---- Cache across Netlify function invocations ----
type Cache = {
  client: MongoClient | null;
  db: Db | null;
  connectPromise: Promise<MongoClient> | null;
  prepared: boolean; // indexes + admin seeded
};

const g = globalThis as unknown as { __docnearmeCache?: Cache };
if (!g.__docnearmeCache) {
  g.__docnearmeCache = {
    client: null,
    db: null,
    connectPromise: null,
    prepared: false,
  };
}
const cache = g.__docnearmeCache;

// Short, serverless-friendly timeouts. Keep pools tiny.
function newClient() {
  return new MongoClient(uri!, {
    serverSelectionTimeoutMS: 5000, // fail fast if cluster unreachable
    socketTimeoutMS: 10000,
    maxPoolSize: 5,
  });
}

async function prepareOnce(db: Db) {
  if (cache.prepared) return;

  // Run in parallel, but only once per warm container
  await Promise.all([
    db.collection<User>("users").createIndex({ email: 1 }, { unique: true }),
    db
      .collection<Appointment>("appointments")
      .createIndex({ dateKey: 1, slot: 1, clinicId: 1 }, { unique: true }),
  ]);

  // Seed admin if missing
  const users = db.collection<User>("users");
  const existingAdmin = await users.findOne({ role: "admin", email: adminEmail });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await users.insertOne({
      email: adminEmail,
      name: "DocNearMe Admin",
      passwordHash,
      role: "admin",
      createdAt: new Date(),
    });
  }

  cache.prepared = true;
}

export async function connectToDatabase(): Promise<Db> {
  if (cache.db) return cache.db;

  if (!cache.connectPromise) {
    cache.connectPromise = newClient().connect();
  }

  // Reuse the same client on warm calls
  const client = await cache.connectPromise;
  const db = client.db(dbName);

  cache.client = client;
  cache.db = db;

  // Make sure prep work runs only once per container
  await prepareOnce(db);

  return db;
}

export async function getUsersCollection(): Promise<Collection<User>> {
  const db = await connectToDatabase();
  return db.collection<User>("users");
}

export async function getAppointmentsCollection(): Promise<Collection<Appointment>> {
  const db = await connectToDatabase();
  return db.collection<Appointment>("appointments");
}
