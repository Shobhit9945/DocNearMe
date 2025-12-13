// server/db.ts
import "dotenv/config";
import bcrypt from "bcryptjs";
import { MongoClient, Db, Collection, ObjectId } from "mongodb";
import { User, Appointment } from "./types";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME ?? "docnearme";
const adminEmail = process.env.ADMIN_EMAIL ?? "admin@docnearme.local";
const adminPassword = process.env.ADMIN_PASSWORD ?? "ChangeMeNow123!";
const preferMemory = process.env.USE_IN_MEMORY_DB === "true";
const allowMemoryFallback = process.env.ALLOW_IN_MEMORY_DB !== "false";

// ---- Cache across Netlify function invocations ----
type Cache = {
  client: MongoClient | null;
  db: Db | InMemoryDb | null;
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

// ---- Lightweight in-memory implementation (used when MongoDB is unavailable) ----
type Predicate<T> = (item: T) => boolean;

function matches<T extends Record<string, unknown>>(item: T, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([key, value]) => {
    const itemValue = (item as Record<string, unknown>)[key];
    if (value instanceof ObjectId) return itemValue?.toString?.() === value.toString();
    return itemValue === value;
  });
}

class InMemoryCursor<T extends Record<string, unknown>> {
  constructor(private items: T[]) {}

  project(fields: Record<string, number>) {
    const includes = Object.entries(fields).filter(([, val]) => Boolean(val)).map(([key]) => key);
    const projected = includes.length
      ? this.items.map((item) => {
          const next: Record<string, unknown> = {};
          includes.forEach((key) => {
            if (key in item) next[key] = item[key];
          });
          return next as T;
        })
      : [...this.items];
    return new InMemoryCursor(projected);
  }

  sort(sortFields: Record<string, 1 | -1>) {
    const sorted = [...this.items].sort((a, b) => {
      for (const [field, direction] of Object.entries(sortFields)) {
        const aVal = (a as Record<string, unknown>)[field];
        const bVal = (b as Record<string, unknown>)[field];
        if (aVal === bVal) continue;
        if (aVal === undefined) return 1;
        if (bVal === undefined) return -1;
        return aVal! > bVal! ? direction : -direction;
      }
      return 0;
    });
    return new InMemoryCursor(sorted);
  }

  async toArray() {
    return [...this.items];
  }
}

class InMemoryCollection<T extends Record<string, unknown>> {
  constructor(private items: T[]) {}

  async createIndex() {
    return "ok";
  }

  async findOne(filter: Record<string, unknown>) {
    return this.items.find((item) => matches(item, filter)) ?? null;
  }

  find(filter: Record<string, unknown>) {
    const predicate: Predicate<T> = (item) => matches(item, filter);
    return new InMemoryCursor(this.items.filter(predicate));
  }

  async insertOne(doc: T & { _id?: ObjectId }) {
    const _id = doc._id ?? new ObjectId();
    this.items.push({ ...doc, _id });
    return { insertedId: _id };
  }
}

type InMemoryDb = {
  kind: "memory";
  collections: {
    users: InMemoryCollection<User>;
    appointments: InMemoryCollection<Appointment>;
  };
};

const inMemoryDb: InMemoryDb = {
  kind: "memory",
  collections: {
    users: new InMemoryCollection<User>([]),
    appointments: new InMemoryCollection<Appointment>([]),
  },
};

const isMemoryDb = (db: Db | InMemoryDb): db is InMemoryDb => (db as InMemoryDb).kind === "memory";

const getCollection = <T>(db: Db | InMemoryDb, name: "users" | "appointments") =>
  isMemoryDb(db) ? db.collections[name] : db.collection<T>(name);

// Short, serverless-friendly timeouts. Keep pools tiny.
function newClient() {
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is required.");
  }

  return new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000, // fail fast if cluster unreachable
    socketTimeoutMS: 10000,
    maxPoolSize: 5,
  });
}

async function prepareOnce(db: Db | InMemoryDb) {
  if (cache.prepared) return;

  const users = getCollection<User>(db, "users");
  const appointments = getCollection<Appointment>(db, "appointments");

  // Run in parallel, but only once per warm container
  await Promise.all([
    users.createIndex({ email: 1 }, { unique: true }),
    appointments.createIndex({ dateKey: 1, slot: 1, clinicId: 1 }, { unique: true }),
  ]);

  // Seed admin if missing
  const existingAdmin = await users.findOne({ role: "admin", email: adminEmail });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await users.insertOne({
      email: adminEmail,
      name: "DocNearMe Admin",
      passwordHash,
      role: "admin",
      createdAt: new Date(),
    } as User);
  }

  cache.prepared = true;
}

export async function connectToDatabase(): Promise<Db | InMemoryDb> {
  if (cache.db) return cache.db;

  if (preferMemory) {
    console.warn("[db] Using in-memory database because USE_IN_MEMORY_DB=true.");
    cache.db = inMemoryDb;
    await prepareOnce(cache.db);
    return cache.db;
  }

  if (!uri) {
    if (!allowMemoryFallback) {
      throw new Error("MONGODB_URI environment variable is required.");
    }

    console.warn("[db] Missing MONGODB_URI. Falling back to in-memory database for this session.");
    cache.db = inMemoryDb;
    await prepareOnce(cache.db);
    return cache.db;
  }

  if (!cache.connectPromise) {
    const host = (() => {
      try {
        const parsed = new URL(uri!);
        return parsed.hostname;
      } catch {
        return "unknown-host";
      }
    })();

    console.info(`[db] Connecting to MongoDB at ${host}...`);
    cache.connectPromise = newClient()
      .connect()
      .catch((err) => {
        cache.connectPromise = null;
        throw err;
      });
  }

  try {
    // Reuse the same client on warm calls
    const client = await cache.connectPromise;
    const db = client.db(dbName);

    cache.client = client;
    cache.db = db;

    // Make sure prep work runs only once per container
    await prepareOnce(db);

    console.info(`[db] Connected to ${db.databaseName}`);

    return db;
  } catch (err) {
    console.error("[db] MongoDB connection failed", err);

    if (!allowMemoryFallback) {
      throw err;
    }

    console.warn("[db] Falling back to in-memory database. Data will reset on each restart.");
    cache.db = inMemoryDb;
    cache.connectPromise = null;
    await prepareOnce(cache.db);
    return cache.db;
  }
}

export async function getUsersCollection(): Promise<Collection<User> | InMemoryCollection<User>> {
  const db = await connectToDatabase();
  return getCollection<User>(db, "users") as Collection<User> | InMemoryCollection<User>;
}

export async function getAppointmentsCollection(): Promise<Collection<Appointment> | InMemoryCollection<Appointment>> {
  const db = await connectToDatabase();
  return getCollection<Appointment>(db, "appointments") as Collection<Appointment> | InMemoryCollection<Appointment>;
}
