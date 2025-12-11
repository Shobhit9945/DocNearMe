import "dotenv/config";
import bcrypt from "bcryptjs";
import { MongoClient, Db, Collection } from "mongodb";
import { User, Appointment } from "./types";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME ?? "docnearme";
const adminEmail = process.env.ADMIN_EMAIL ?? "admin@docnearme.local";
const adminPassword = process.env.ADMIN_PASSWORD ?? "ChangeMeNow123!";

let client: MongoClient | null = null;
let database: Db | null = null;

export async function connectToDatabase(): Promise<Db> {
  if (database) return database;
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is required to start the server.");
  }

  client = new MongoClient(uri);
  await client.connect();
  database = client.db(dbName);

  await ensureIndexes(database);
  await ensureAdminAccount(database);

  return database;
}

async function ensureIndexes(db: Db) {
  await Promise.all([
    db.collection<User>("users").createIndex({ email: 1 }, { unique: true }),
    db
      .collection<Appointment>("appointments")
      .createIndex({ dateKey: 1, slot: 1, clinicId: 1 }, { unique: true }),
  ]);
}

async function ensureAdminAccount(db: Db) {
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
}

export async function getUsersCollection(): Promise<Collection<User>> {
  const db = await connectToDatabase();
  return db.collection<User>("users");
}

export async function getAppointmentsCollection(): Promise<Collection<Appointment>> {
  const db = await connectToDatabase();
  return db.collection<Appointment>("appointments");
}
