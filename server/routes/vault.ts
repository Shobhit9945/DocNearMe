import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { getVaultDocsCollection, getVaultKeysCollection } from "../db";
import type { VaultDocument, VaultKeyRecord } from "../types";
import type { AuthContext } from "../middleware/auth";

type AuthedRequest = Request & { auth?: AuthContext };

const MAX_KEY_PART_LENGTH = 8192;
const MAX_DOC_NAME_LENGTH = 160;
const MAX_DOC_SIZE_BYTES = 8 * 1024 * 1024;

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

const serializeVaultKey = (record: VaultKeyRecord) => ({
  dekWrappedByPassword: record.dekWrappedByPassword,
  dekWrappedByRecovery: record.dekWrappedByRecovery,
  kdfSaltPassword: record.kdfSaltPassword,
  kdfSaltRecovery: record.kdfSaltRecovery,
  kdfParams: record.kdfParams,
  aead: record.aead,
  wrapIvPassword: record.wrapIvPassword,
  wrapIvRecovery: record.wrapIvRecovery,
});

const serializeVaultDocSummary = (record: VaultDocument) => ({
  id: record.docId,
  name: record.name,
  type: record.type,
  size: record.size,
  createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt,
});

const serializeVaultDocDetail = (record: VaultDocument) => ({
  ...serializeVaultDocSummary(record),
  iv: record.iv,
  ciphertext: record.ciphertext,
  aad: record.aad,
});

const isValidKdfParams = (params: unknown): params is VaultKeyRecord["kdfParams"] => {
  if (!params || typeof params !== "object") return false;
  const record = params as Record<string, unknown>;
  if (record.algo === "argon2id") {
    return (
      typeof record.opslimit === "number" &&
      typeof record.memlimit === "number" &&
      typeof record.keyLen === "number"
    );
  }
  if (record.algo === "scrypt") {
    return (
      typeof record.N === "number" &&
      typeof record.r === "number" &&
      typeof record.p === "number" &&
      typeof record.keyLen === "number"
    );
  }
  if (record.algo === "pbkdf2") {
    return (
      typeof record.iterations === "number" &&
      typeof record.keyLen === "number" &&
      record.hash === "SHA-256"
    );
  }
  return false;
};

export const handleGetVaultKeys = async (req: AuthedRequest, res: Response) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const keys = await getVaultKeysCollection();
    const record = await keys.findOne({ userId: req.auth.id });

    if (!record) {
      return res.json({ hasKey: false });
    }

    return res.json({ hasKey: true, key: serializeVaultKey(record) });
  } catch {
    return res.status(500).json({ error: "Failed to load vault keys." });
  }
};

export const handleCreateVaultKeys = async (req: AuthedRequest, res: Response) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const payload = parseRequestBody(req.body);
  const dekWrappedByPassword = typeof payload.dekWrappedByPassword === "string" ? payload.dekWrappedByPassword : "";
  const dekWrappedByRecovery = typeof payload.dekWrappedByRecovery === "string" ? payload.dekWrappedByRecovery : "";
  const kdfSaltPassword = typeof payload.kdfSaltPassword === "string" ? payload.kdfSaltPassword : "";
  const kdfSaltRecovery = typeof payload.kdfSaltRecovery === "string" ? payload.kdfSaltRecovery : "";
  const wrapIvPassword = typeof payload.wrapIvPassword === "string" ? payload.wrapIvPassword : "";
  const wrapIvRecovery = typeof payload.wrapIvRecovery === "string" ? payload.wrapIvRecovery : "";
  const kdfParams = payload.kdfParams;
  const aead = payload.aead === "aes-256-gcm" ? "aes-256-gcm" : "";

  if (
    !dekWrappedByPassword ||
    !dekWrappedByRecovery ||
    !kdfSaltPassword ||
    !kdfSaltRecovery ||
    !wrapIvPassword ||
    !wrapIvRecovery ||
    !aead ||
    !isValidKdfParams(kdfParams)
  ) {
    return res.status(400).json({ error: "Missing required vault key fields." });
  }

  const keyParts = [
    dekWrappedByPassword,
    dekWrappedByRecovery,
    kdfSaltPassword,
    kdfSaltRecovery,
    wrapIvPassword,
    wrapIvRecovery,
  ];

  if (keyParts.some((value) => value.length > MAX_KEY_PART_LENGTH)) {
    return res.status(400).json({ error: "Vault key material is too large." });
  }

  try {
    const keys = await getVaultKeysCollection();
    const existing = await keys.findOne({ userId: req.auth.id });

    if (existing) {
      await keys.updateOne(
        { userId: req.auth.id },
        {
          $set: {
            dekWrappedByPassword,
            dekWrappedByRecovery,
            kdfSaltPassword,
            kdfSaltRecovery,
            kdfParams,
            aead: "aes-256-gcm",
            wrapIvPassword,
            wrapIvRecovery,
            updatedAt: new Date(),
          },
        },
      );
    } else {
      const record: VaultKeyRecord = {
        userId: req.auth.id,
        dekWrappedByPassword,
        dekWrappedByRecovery,
        kdfSaltPassword,
        kdfSaltRecovery,
        kdfParams,
        aead: "aes-256-gcm",
        wrapIvPassword,
        wrapIvRecovery,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await keys.insertOne(record);
    }

    return res.status(201).json({ success: true, updatedAt: new Date().toISOString() });
  } catch {
    return res.status(500).json({ error: "Failed to store vault keys." });
  }
};

export const handleUpdateVaultPassword = async (req: AuthedRequest, res: Response) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const payload = parseRequestBody(req.body);
  const dekWrappedByPassword = typeof payload.dekWrappedByPassword === "string" ? payload.dekWrappedByPassword : "";
  const kdfSaltPassword = typeof payload.kdfSaltPassword === "string" ? payload.kdfSaltPassword : "";
  const wrapIvPassword = typeof payload.wrapIvPassword === "string" ? payload.wrapIvPassword : "";
  const kdfParams = payload.kdfParams;
  const aead = payload.aead === "aes-256-gcm" ? "aes-256-gcm" : "";

  if (!dekWrappedByPassword || !kdfSaltPassword || !wrapIvPassword || !aead || !isValidKdfParams(kdfParams)) {
    return res.status(400).json({ error: "Missing required vault password fields." });
  }

  if (
    dekWrappedByPassword.length > MAX_KEY_PART_LENGTH ||
    kdfSaltPassword.length > MAX_KEY_PART_LENGTH ||
    wrapIvPassword.length > MAX_KEY_PART_LENGTH
  ) {
    return res.status(400).json({ error: "Vault key material is too large." });
  }

  try {
    const keys = await getVaultKeysCollection();
    const existing = await keys.findOne({ userId: req.auth.id });
    if (!existing) {
      return res.status(404).json({ error: "Vault keys not found." });
    }

    await keys.updateOne(
      { userId: req.auth.id },
      {
        $set: {
          dekWrappedByPassword,
          kdfSaltPassword,
          kdfParams,
          aead: "aes-256-gcm",
          wrapIvPassword,
          updatedAt: new Date(),
        },
      },
    );

    return res.json({ success: true, updatedAt: new Date().toISOString() });
  } catch {
    return res.status(500).json({ error: "Failed to update vault password." });
  }
};

export const handleListVaultDocs = async (req: AuthedRequest, res: Response) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const docId = typeof req.query.docId === "string" ? req.query.docId.trim() : "";

  try {
    const docs = await getVaultDocsCollection();

    if (docId) {
      const record = await docs.findOne({ docId, userId: req.auth.id });
      if (!record) {
        return res.status(404).json({ error: "Vault document not found." });
      }
      return res.json({ doc: serializeVaultDocDetail(record) });
    }

    const data = await docs.find({ userId: req.auth.id }).sort({ createdAt: -1 }).toArray();
    return res.json({ docs: data.map(serializeVaultDocSummary) });
  } catch {
    return res.status(500).json({ error: "Failed to load vault documents." });
  }
};

export const handleCreateVaultDoc = async (req: AuthedRequest, res: Response) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const payload = parseRequestBody(req.body);
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const type = typeof payload.type === "string" ? payload.type.trim() : "";
  const size = typeof payload.size === "number" ? payload.size : Number(payload.size);
  const iv = typeof payload.iv === "string" ? payload.iv : "";
  const ciphertext = typeof payload.ciphertext === "string" ? payload.ciphertext : "";
  const aad = typeof payload.aad === "string" ? payload.aad : undefined;
  const id = typeof payload.id === "string" ? payload.id.trim() : "";

  if (!name || !type || !iv || !ciphertext || !size) {
    return res.status(400).json({ error: "Missing required vault document fields." });
  }

  if (name.length > MAX_DOC_NAME_LENGTH) {
    return res.status(400).json({ error: "Document name is too long." });
  }

  if (Number.isNaN(size) || size <= 0 || size > MAX_DOC_SIZE_BYTES) {
    return res.status(400).json({ error: "Document size exceeds the allowed limit." });
  }

  try {
    const docs = await getVaultDocsCollection();
    const record: Omit<VaultDocument, "_id"> = {
      userId: req.auth.id,
      docId: id || new ObjectId().toString(),
      name,
      type,
      size,
      iv,
      ciphertext,
      aad,
      createdAt: new Date(),
    };

    await docs.insertOne(record);
    return res.status(201).json({
      success: true,
      doc: serializeVaultDocSummary(record as VaultDocument),
    });
  } catch {
    return res.status(500).json({ error: "Failed to store vault document." });
  }
};

export const handleDeleteVaultDoc = async (req: AuthedRequest, res: Response) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const docId = req.params.id;
  if (!docId) {
    return res.status(400).json({ error: "Missing document id." });
  }

  try {
    const docs = await getVaultDocsCollection();
    const result = await docs.deleteOne({ docId, userId: req.auth.id });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Vault document not found." });
    }

    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: "Failed to delete vault document." });
  }
};

export const handleRenameVaultDoc = async (req: AuthedRequest, res: Response) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const docId = req.params.id;
  if (!docId) {
    return res.status(400).json({ error: "Missing document id." });
  }

  const payload = parseRequestBody(req.body);
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  if (!name) {
    return res.status(400).json({ error: "Document name is required." });
  }
  if (name.length > MAX_DOC_NAME_LENGTH) {
    return res.status(400).json({ error: "Document name is too long." });
  }

  try {
    const docs = await getVaultDocsCollection();
    const existing = await docs.findOne({ docId, userId: req.auth.id });

    if (!existing) {
      return res.status(404).json({ error: "Vault document not found." });
    }

    await docs.updateOne({ docId, userId: req.auth.id }, { $set: { name } });

    return res.json({ success: true, doc: serializeVaultDocSummary({ ...existing, name }) });
  } catch {
    return res.status(500).json({ error: "Failed to rename vault document." });
  }
};
