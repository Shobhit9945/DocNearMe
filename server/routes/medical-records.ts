import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { getMedicalConsentsCollection, getMedicalRecordsCollection } from "../db";
import { MedicalConsent, MedicalRecord } from "../types";

const CONSENT_VERSION = "2024-09-01";
const CONSENT_TEXT =
  "I consent to the secure storage of my encrypted medical records on DocNearMe servers. " +
  "I understand the files are encrypted in my browser and only I can decrypt them.";
const MAX_UPLOAD_SIZE_BYTES = 8 * 1024 * 1024;
const MAX_RECORD_NAME_LENGTH = 120;

const parseRequestBody = (body: unknown): Record<string, unknown> => {
  if (body instanceof Buffer) {
    return parseRequestBody(body.toString("utf8"));
  }
  if (body instanceof Uint8Array) {
    return parseRequestBody(Buffer.from(body).toString("utf8"));
  }
  if (body && typeof body === "object") return body as Record<string, unknown>;
  if (typeof body !== "string") return {};

  const trimmed = body.trim();
  if (!trimmed) return {};

  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const params = new URLSearchParams(trimmed);
    const payload: Record<string, string> = {};
    params.forEach((value, key) => {
      payload[key] = value;
    });
    return payload;
  }
};

const serializeRecord = (record: MedicalRecord) => ({
  id: record._id ? (record._id instanceof ObjectId ? record._id.toString() : String(record._id)) : "",
  name: record.name,
  type: record.type,
  size: record.size,
  iv: record.iv,
  data: record.data,
  createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt,
});

export const handleGetMedicalConsent = async (req: Request, res: Response) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const consents = await getMedicalConsentsCollection();
    const consent = await consents.findOne({
      patientId: req.auth.id,
      consentVersion: CONSENT_VERSION,
    });

    return res.json({
      hasConsented: Boolean(consent),
      consentedAt: consent?.consentedAt ? consent.consentedAt.toISOString() : undefined,
      consentVersion: CONSENT_VERSION,
    });
  } catch (error) {
    console.error("Medical consent lookup failed", error);
    return res.status(500).json({ error: "Failed to check medical consent." });
  }
};

export const handleCreateMedicalConsent = async (req: Request, res: Response) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const payload = parseRequestBody(req.body);
  const consentText = typeof payload.consentText === "string" ? payload.consentText : CONSENT_TEXT;
  const consentVersion =
    typeof payload.consentVersion === "string" && payload.consentVersion.trim()
      ? payload.consentVersion
      : CONSENT_VERSION;

  try {
    const consents = await getMedicalConsentsCollection();
    const existing = await consents.findOne({
      patientId: req.auth.id,
      consentVersion,
    });

    if (existing) {
      return res.json({
        success: true,
        consentedAt: existing.consentedAt.toISOString(),
        consentVersion,
      });
    }

    const record: MedicalConsent = {
      patientId: req.auth.id,
      consentVersion,
      consentText,
      consentedAt: new Date(),
      ipAddress: req.ip,
      userAgent: req.get("user-agent") ?? undefined,
    };

    await consents.insertOne(record);

    return res.status(201).json({
      success: true,
      consentedAt: record.consentedAt.toISOString(),
      consentVersion,
    });
  } catch (error) {
    console.error("Medical consent creation failed", error);
    return res.status(500).json({ error: "Failed to store medical consent." });
  }
};

export const handleListMedicalRecords = async (req: Request, res: Response) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const records = await getMedicalRecordsCollection();
    const data = await records
      .find({ patientId: req.auth.id })
      .sort({ createdAt: -1 })
      .toArray();

    return res.json({
      records: data.map(serializeRecord),
    });
  } catch (error) {
    console.error("Medical records fetch failed", error);
    return res.status(500).json({ error: "Failed to load medical records." });
  }
};

export const handleUploadMedicalRecord = async (req: Request, res: Response) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const payload = parseRequestBody(req.body);
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const type = typeof payload.type === "string" ? payload.type.trim() : "";
  const size = typeof payload.size === "number" ? payload.size : Number(payload.size);
  const iv = typeof payload.iv === "string" ? payload.iv : "";
  const data = typeof payload.data === "string" ? payload.data : "";

  if (!name || !type || !iv || !data || !size) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  if (!type.startsWith("image/") && type !== "application/pdf") {
    return res.status(400).json({ error: "Unsupported file type." });
  }

  if (Number.isNaN(size) || size <= 0 || size > MAX_UPLOAD_SIZE_BYTES) {
    return res.status(400).json({ error: "File size exceeds the allowed limit." });
  }

  try {
    const consents = await getMedicalConsentsCollection();
    const consent = await consents.findOne({
      patientId: req.auth.id,
      consentVersion: CONSENT_VERSION,
    });
    if (!consent) {
      return res.status(403).json({ error: "Medical data consent required." });
    }

    const records = await getMedicalRecordsCollection();
    const record: MedicalRecord = {
      patientId: req.auth.id,
      name,
      type,
      size,
      iv,
      data,
      createdAt: new Date(),
    };

    const result = await records.insertOne(record);

    return res.status(201).json({
      success: true,
      record: serializeRecord({ ...record, _id: result.insertedId }),
    });
  } catch (error) {
    console.error("Medical record upload failed", error);
    return res.status(500).json({ error: "Failed to save medical record." });
  }
};

export const handleDeleteMedicalRecord = async (req: Request, res: Response) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const recordId = req.params.id;
  if (!recordId) {
    return res.status(400).json({ error: "Missing record id." });
  }

  try {
    const records = await getMedicalRecordsCollection();
    const lookupId = ObjectId.isValid(recordId) ? new ObjectId(recordId) : recordId;
    const result = await records.deleteOne({ _id: lookupId, patientId: req.auth.id });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Record not found." });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("Medical record deletion failed", error);
    return res.status(500).json({ error: "Failed to delete medical record." });
  }
};

export const handleRenameMedicalRecord = async (req: Request, res: Response) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const recordId = req.params.id;
  if (!recordId) {
    return res.status(400).json({ error: "Missing record id." });
  }

  const payload = parseRequestBody(req.body);
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  if (!name) {
    return res.status(400).json({ error: "Record name is required." });
  }
  if (name.length > MAX_RECORD_NAME_LENGTH) {
    return res.status(400).json({ error: "Record name is too long." });
  }

  try {
    const records = await getMedicalRecordsCollection();
    const lookupId = ObjectId.isValid(recordId) ? new ObjectId(recordId) : recordId;
    const existing = await records.findOne({ _id: lookupId, patientId: req.auth.id });

    if (!existing) {
      return res.status(404).json({ error: "Record not found." });
    }

    await records.updateOne({ _id: lookupId, patientId: req.auth.id }, { $set: { name } });

    return res.json({ success: true, record: serializeRecord({ ...existing, name }) });
  } catch (error) {
    console.error("Medical record rename failed", error);
    return res.status(500).json({ error: "Failed to rename medical record." });
  }
};

export const medicalConsentCopy = {
  version: CONSENT_VERSION,
  text: CONSENT_TEXT,
};
