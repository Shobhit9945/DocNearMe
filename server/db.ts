// server/db.ts
import "dotenv/config";
import bcryptjs from "bcryptjs";
import { MongoClient, Db, Collection, ObjectId } from "mongodb";
import {
  Appointment,
  ClinicReview,
  ClinicAccount,
  ClinicDoctorRecord,
  ClinicInfo,
  EmailOtp,
  MedicalConsent,
  MedicalRecord,
  MedicalRecordKey,
  PatientUser,
} from "./types";

const uri = process.env.MONGODB_URI ?? process.env.MONGODB_API_URL ?? process.env.VITE_MONGODB_API_URL;
const dbName = process.env.MONGODB_DB_NAME ?? process.env.MONGODB_DATABASE ?? "patients";
const clinicDbName =
  process.env.MONGODB_CLINIC_DB_NAME ?? process.env.MONGODB_CLINIC_DATABASE ?? "clinics";
const preferMemory = process.env.USE_IN_MEMORY_DB === "true";
const allowMemoryFallback = process.env.ALLOW_IN_MEMORY_DB !== "false";

// ---- Cache across Netlify function invocations ----
type Cache = {
  client: MongoClient | null;
  patientDb: Db | InMemoryPatientDb | null;
  clinicDb: Db | InMemoryClinicDb | null;
  connectPromise: Promise<MongoClient> | null;
  preparedPatients: boolean;
  preparedClinics: boolean;
};

const g = globalThis as unknown as { __docnearmeCache?: Cache };
if (!g.__docnearmeCache) {
  g.__docnearmeCache = {
    client: null,
    patientDb: null,
    clinicDb: null,
    connectPromise: null,
    preparedPatients: false,
    preparedClinics: false,
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

  async createIndex(..._args: unknown[]) {
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

  async updateOne(filter: Record<string, unknown>, update: Record<string, unknown>) {
    const item = this.items.find((entry) => matches(entry, filter));
    if (!item) {
      return { matchedCount: 0, modifiedCount: 0 };
    }

    if (update.$set && typeof update.$set === "object") {
      Object.entries(update.$set as Record<string, unknown>).forEach(([key, value]) => {
        (item as Record<string, unknown>)[key] = value;
      });
    }

    if (update.$push && typeof update.$push === "object") {
      Object.entries(update.$push as Record<string, unknown>).forEach(([key, value]) => {
        const existing = (item as Record<string, unknown>)[key];
        if (Array.isArray(existing)) {
          existing.push(value);
        } else {
          (item as Record<string, unknown>)[key] = [value];
        }
      });
    }

    return { matchedCount: 1, modifiedCount: 1 };
  }

  async deleteOne(filter: Record<string, unknown>) {
    const index = this.items.findIndex((entry) => matches(entry, filter));
    if (index === -1) {
      return { deletedCount: 0 };
    }
    this.items.splice(index, 1);
    return { deletedCount: 1 };
  }
}

export type InMemoryPatientDb = {
  kind: "memory";
  collections: {
    appointments: InMemoryCollection<Appointment>;
    patients: InMemoryCollection<PatientUser>;
    emailOtps: InMemoryCollection<EmailOtp>;
    medicalRecords: InMemoryCollection<MedicalRecord>;
    medicalConsents: InMemoryCollection<MedicalConsent>;
    medicalRecordKeys: InMemoryCollection<MedicalRecordKey>;
  };
};

export type InMemoryClinicDb = {
  kind: "memory";
  collections: {
    clinicReviews: InMemoryCollection<ClinicReview>;
    clinicAccounts: InMemoryCollection<ClinicAccount>;
    clinicInfo: InMemoryCollection<ClinicInfo>;
    clinicDoctors: InMemoryCollection<ClinicDoctorRecord>;
  };
};

const inMemoryPatientDb: InMemoryPatientDb = {
  kind: "memory",
  collections: {
    appointments: new InMemoryCollection<Appointment>([]),
    patients: new InMemoryCollection<PatientUser>([]),
    emailOtps: new InMemoryCollection<EmailOtp>([]),
    medicalRecords: new InMemoryCollection<MedicalRecord>([]),
    medicalConsents: new InMemoryCollection<MedicalConsent>([]),
    medicalRecordKeys: new InMemoryCollection<MedicalRecordKey>([]),
  },
};

const inMemoryClinicDb: InMemoryClinicDb = {
  kind: "memory",
  collections: {
    clinicReviews: new InMemoryCollection<ClinicReview>([]),
    clinicAccounts: new InMemoryCollection<ClinicAccount>([]),
    clinicInfo: new InMemoryCollection<ClinicInfo>([]),
    clinicDoctors: new InMemoryCollection<ClinicDoctorRecord>([]),
  },
};

export const isMemoryPatientDb = (db: Db | InMemoryPatientDb): db is InMemoryPatientDb =>
  (db as InMemoryPatientDb).kind === "memory";
export const isMemoryClinicDb = (db: Db | InMemoryClinicDb): db is InMemoryClinicDb =>
  (db as InMemoryClinicDb).kind === "memory";

const getPatientCollection = <T>(
  db: Db | InMemoryPatientDb,
  name: "appointments" | "patients" | "emailOtps" | "medicalRecords" | "medicalConsents" | "medicalRecordKeys",
) => (isMemoryPatientDb(db) ? db.collections[name] : db.collection<T>(name));

const getClinicCollection = <T>(
  db: Db | InMemoryClinicDb,
  name: "clinicReviews" | "clinicAccounts" | "clinicInfo" | "clinicDoctors",
) => (isMemoryClinicDb(db) ? db.collections[name] : db.collection<T>(name));

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

async function preparePatientOnce(db: Db | InMemoryPatientDb) {
  if (cache.preparedPatients) return;

  const appointments = getPatientCollection<Appointment>(db, "appointments");
  const patients = getPatientCollection<PatientUser>(db, "patients");
  const emailOtps = getPatientCollection<EmailOtp>(db, "emailOtps");
  const medicalRecords = getPatientCollection<MedicalRecord>(db, "medicalRecords");
  const medicalConsents = getPatientCollection<MedicalConsent>(db, "medicalConsents");
  const medicalRecordKeys = getPatientCollection<MedicalRecordKey>(db, "medicalRecordKeys");

  // Run in parallel, but only once per warm container
  await Promise.all([
    appointments.createIndex({ dateKey: 1, slot: 1, clinicId: 1 }, { unique: true }),
    patients.createIndex({ email: 1 }, { unique: true }),
    emailOtps.createIndex({ email: 1, createdAt: -1 }),
    emailOtps.createIndex({ expiresAt: 1 }),
    medicalRecords.createIndex({ patientId: 1, createdAt: -1 }),
    medicalConsents.createIndex({ patientId: 1, consentVersion: 1 }, { unique: true }),
    medicalRecordKeys.createIndex({ patientId: 1 }, { unique: true }),
  ]);

  cache.preparedPatients = true;
}

async function prepareClinicOnce(db: Db | InMemoryClinicDb) {
  if (cache.preparedClinics) return;

  const clinicReviews = getClinicCollection<ClinicReview>(db, "clinicReviews");
  const clinicAccounts = getClinicCollection<ClinicAccount>(db, "clinicAccounts");
  const clinicInfo = getClinicCollection<ClinicInfo>(db, "clinicInfo");
  const clinicDoctors = getClinicCollection<ClinicDoctorRecord>(db, "clinicDoctors");

  await Promise.all([
    clinicReviews.createIndex({ clinicId: 1, createdAt: -1 }),
    clinicAccounts.createIndex({ clinicId: 1 }, { unique: true }),
    clinicAccounts.createIndex({ userId: 1 }, { unique: true }),
    clinicInfo.createIndex({ clinicId: 1 }, { unique: true }),
    clinicDoctors.createIndex({ clinicId: 1 }),
    clinicDoctors.createIndex({ doctorId: 1 }, { unique: true }),
  ]);

  await seedClinicData(db);

  cache.preparedClinics = true;
}

async function seedClinicData(db: Db | InMemoryClinicDb) {
  const clinics = getClinicCollection<ClinicInfo>(db, "clinicInfo");
  const clinicAccounts = getClinicCollection<ClinicAccount>(db, "clinicAccounts");
  const clinicDoctors = getClinicCollection<ClinicDoctorRecord>(db, "clinicDoctors");

  const existingClinic = await clinics.findOne({});
  if (existingClinic) {
    return;
  }

  const { CLINIC_SEED, DOCTOR_SEED } = await import("../shared/clinic-seed");

  const clinicInsertions = CLINIC_SEED.map((clinic) =>
    clinics.insertOne({
      ...clinic,
      clinicId: clinic.id,
      updatedAt: new Date(),
    }),
  );
  await Promise.all(clinicInsertions);

  await Promise.all(
    CLINIC_SEED.map(async (clinic) => {
      const tempPassword = `clinic-${clinic.id}-2024`;
      const passwordHash = await bcryptjs.hash(tempPassword, 10);
      return clinicAccounts.insertOne({
        clinicId: clinic.id,
        userId: `${clinic.id}-admin`,
        passwordHash,
        tempPassword,
        createdAt: new Date(),
      });
    }),
  );

  const doctorInsertions = DOCTOR_SEED.map((doctor) =>
    clinicDoctors.insertOne({
      clinicId: doctor.clinicId,
      doctorId: doctor.id,
      name: doctor.name,
      specialization: doctor.specialization,
      languages: doctor.languages,
      rating: doctor.rating,
      nextAvailable: doctor.nextAvailable,
      availability: doctor.availability,
      updatedAt: new Date(),
    }),
  );
  await Promise.all(doctorInsertions);
}

async function connectToMongoClient() {
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

  return cache.connectPromise;
}

export async function connectToDatabase(): Promise<Db | InMemoryPatientDb> {
  if (cache.patientDb) return cache.patientDb;

  if (preferMemory) {
    console.warn("[db] Using in-memory database because USE_IN_MEMORY_DB=true.");
    cache.patientDb = inMemoryPatientDb;
    cache.clinicDb = inMemoryClinicDb;
    await Promise.all([preparePatientOnce(cache.patientDb), prepareClinicOnce(cache.clinicDb)]);
    return cache.patientDb;
  }

  if (!uri) {
    if (!allowMemoryFallback) {
      throw new Error("MONGODB_URI environment variable is required.");
    }

    console.warn("[db] Missing MONGODB_URI. Falling back to in-memory database for this session.");
    cache.patientDb = inMemoryPatientDb;
    cache.clinicDb = inMemoryClinicDb;
    await Promise.all([preparePatientOnce(cache.patientDb), prepareClinicOnce(cache.clinicDb)]);
    return cache.patientDb;
  }

  try {
    // Reuse the same client on warm calls
    const client = await connectToMongoClient();
    const patientDb = client.db(dbName);
    const clinicDb = client.db(clinicDbName);

    cache.client = client;
    cache.patientDb = patientDb;
    cache.clinicDb = clinicDb;

    // Make sure prep work runs only once per container
    await Promise.all([preparePatientOnce(patientDb), prepareClinicOnce(clinicDb)]);

    console.info(`[db] Connected to patient DB ${patientDb.databaseName} and clinic DB ${clinicDb.databaseName}`);

    return patientDb;
  } catch (err) {
    console.error("[db] MongoDB connection failed", err);

    if (!allowMemoryFallback) {
      throw err;
    }

    console.warn("[db] Falling back to in-memory database. Data will reset on each restart.");
    cache.patientDb = inMemoryPatientDb;
    cache.clinicDb = inMemoryClinicDb;
    cache.connectPromise = null;
    await Promise.all([preparePatientOnce(cache.patientDb), prepareClinicOnce(cache.clinicDb)]);
    return cache.patientDb;
  }
}

export async function getAppointmentsCollection(): Promise<Collection<Appointment> | InMemoryCollection<Appointment>> {
  const db = await connectToDatabase();
  return getPatientCollection<Appointment>(db, "appointments") as
    | Collection<Appointment>
    | InMemoryCollection<Appointment>;
}

export async function getPatientsCollection(): Promise<Collection<PatientUser> | InMemoryCollection<PatientUser>> {
  const db = await connectToDatabase();
  return getPatientCollection<PatientUser>(db, "patients") as Collection<PatientUser> | InMemoryCollection<PatientUser>;
}

export async function getEmailOtpsCollection(): Promise<Collection<EmailOtp> | InMemoryCollection<EmailOtp>> {
  const db = await connectToDatabase();
  return getPatientCollection<EmailOtp>(db, "emailOtps") as Collection<EmailOtp> | InMemoryCollection<EmailOtp>;
}

export async function getMedicalRecordsCollection(): Promise<Collection<MedicalRecord> | InMemoryCollection<MedicalRecord>> {
  const db = await connectToDatabase();
  return getPatientCollection<MedicalRecord>(db, "medicalRecords") as
    | Collection<MedicalRecord>
    | InMemoryCollection<MedicalRecord>;
}

export async function getMedicalConsentsCollection(): Promise<
  Collection<MedicalConsent> | InMemoryCollection<MedicalConsent>
> {
  const db = await connectToDatabase();
  return getPatientCollection<MedicalConsent>(db, "medicalConsents") as
    | Collection<MedicalConsent>
    | InMemoryCollection<MedicalConsent>;
}

export async function getMedicalRecordKeysCollection(): Promise<
  Collection<MedicalRecordKey> | InMemoryCollection<MedicalRecordKey>
> {
  const db = await connectToDatabase();
  return getPatientCollection<MedicalRecordKey>(db, "medicalRecordKeys") as
    | Collection<MedicalRecordKey>
    | InMemoryCollection<MedicalRecordKey>;
}

export async function getClinicReviewsCollection(): Promise<
  Collection<ClinicReview> | InMemoryCollection<ClinicReview>
> {
  const db = await connectToClinicDatabase();
  return getClinicCollection<ClinicReview>(db, "clinicReviews") as
    | Collection<ClinicReview>
    | InMemoryCollection<ClinicReview>;
}

export async function getClinicAccountsCollection(): Promise<
  Collection<ClinicAccount> | InMemoryCollection<ClinicAccount>
> {
  const db = await connectToClinicDatabase();
  return getClinicCollection<ClinicAccount>(db, "clinicAccounts") as
    | Collection<ClinicAccount>
    | InMemoryCollection<ClinicAccount>;
}

export async function getClinicInfoCollection(): Promise<Collection<ClinicInfo> | InMemoryCollection<ClinicInfo>> {
  const db = await connectToClinicDatabase();
  return getClinicCollection<ClinicInfo>(db, "clinicInfo") as Collection<ClinicInfo> | InMemoryCollection<ClinicInfo>;
}

export async function getClinicDoctorsCollection(): Promise<
  Collection<ClinicDoctorRecord> | InMemoryCollection<ClinicDoctorRecord>
> {
  const db = await connectToClinicDatabase();
  return getClinicCollection<ClinicDoctorRecord>(db, "clinicDoctors") as
    | Collection<ClinicDoctorRecord>
    | InMemoryCollection<ClinicDoctorRecord>;
}

export async function connectToClinicDatabase(): Promise<Db | InMemoryClinicDb> {
  if (cache.clinicDb) return cache.clinicDb;

  if (preferMemory) {
    console.warn("[db] Using in-memory clinic database because USE_IN_MEMORY_DB=true.");
    cache.patientDb = inMemoryPatientDb;
    cache.clinicDb = inMemoryClinicDb;
    await Promise.all([preparePatientOnce(cache.patientDb), prepareClinicOnce(cache.clinicDb)]);
    return cache.clinicDb;
  }

  if (!uri) {
    if (!allowMemoryFallback) {
      throw new Error("MONGODB_URI environment variable is required.");
    }

    console.warn("[db] Missing MONGODB_URI. Falling back to in-memory clinic database for this session.");
    cache.patientDb = inMemoryPatientDb;
    cache.clinicDb = inMemoryClinicDb;
    await Promise.all([preparePatientOnce(cache.patientDb), prepareClinicOnce(cache.clinicDb)]);
    return cache.clinicDb;
  }

  try {
    const client = await connectToMongoClient();
    const patientDb = client.db(dbName);
    const clinicDb = client.db(clinicDbName);

    cache.client = client;
    cache.patientDb = patientDb;
    cache.clinicDb = clinicDb;

    await Promise.all([preparePatientOnce(patientDb), prepareClinicOnce(clinicDb)]);

    console.info(`[db] Connected to patient DB ${patientDb.databaseName} and clinic DB ${clinicDb.databaseName}`);

    return clinicDb;
  } catch (err) {
    console.error("[db] MongoDB connection failed", err);

    if (!allowMemoryFallback) {
      throw err;
    }

    console.warn("[db] Falling back to in-memory clinic database. Data will reset on each restart.");
    cache.patientDb = inMemoryPatientDb;
    cache.clinicDb = inMemoryClinicDb;
    cache.connectPromise = null;
    await Promise.all([preparePatientOnce(cache.patientDb), prepareClinicOnce(cache.clinicDb)]);
    return cache.clinicDb;
  }
}
