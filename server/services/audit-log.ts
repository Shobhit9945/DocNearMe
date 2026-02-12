import type { Request } from "express";
import { ObjectId } from "mongodb";
import type {
  AuditAction,
  AuditActorRole,
  AuditEventSource,
  AdminAuditLogsResponse,
  AuditLogEntry,
} from "@shared/api";
import { getAuditLogsCollection } from "../db";
import type { AuditLog } from "../types";

type AuditLogWriteInput = {
  action: AuditAction;
  actorRole: AuditActorRole;
  actorId?: string;
  actorLabel?: string;
  clinicId?: string;
  patientId?: string;
  appointmentId?: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  source?: AuditEventSource;
  ipAddress?: string;
  userAgent?: string;
};

type AuditLogQuery = {
  limit?: number;
  action?: AuditAction;
  actorRole?: AuditActorRole;
  clinicId?: string;
  patientId?: string;
  appointmentId?: string;
};

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

const normalizeText = (value?: string) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const sanitizeDetails = (details?: Record<string, unknown>) => {
  if (!details) return undefined;
  try {
    return JSON.parse(JSON.stringify(details)) as Record<string, unknown>;
  } catch {
    return undefined;
  }
};

const serializeAuditLog = (record: AuditLog): AuditLogEntry => ({
  id:
    record._id instanceof ObjectId
      ? record._id.toString()
      : record._id !== undefined && record._id !== null
        ? String(record._id)
        : "",
  action: record.action,
  actorRole: record.actorRole,
  actorId: record.actorId,
  actorLabel: record.actorLabel,
  clinicId: record.clinicId,
  patientId: record.patientId,
  appointmentId: record.appointmentId,
  targetType: record.targetType,
  targetId: record.targetId,
  details: record.details,
  source: record.source,
  ipAddress: record.ipAddress,
  userAgent: record.userAgent,
  createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : new Date(record.createdAt).toISOString(),
});

export const getAuditRequestMeta = (req: Request) => ({
  ipAddress: normalizeText(req.ip),
  userAgent: normalizeText(req.get("user-agent") ?? undefined),
});

export const logAuditEvent = async (input: AuditLogWriteInput) => {
  try {
    const collection = await getAuditLogsCollection();
    const doc: AuditLog = {
      action: input.action,
      actorRole: input.actorRole,
      actorId: normalizeText(input.actorId),
      actorLabel: normalizeText(input.actorLabel),
      clinicId: normalizeText(input.clinicId),
      patientId: normalizeText(input.patientId),
      appointmentId: normalizeText(input.appointmentId),
      targetType: normalizeText(input.targetType),
      targetId: normalizeText(input.targetId),
      details: sanitizeDetails(input.details),
      source: input.source ?? "api",
      ipAddress: normalizeText(input.ipAddress),
      userAgent: normalizeText(input.userAgent),
      createdAt: new Date(),
    };
    await collection.insertOne(doc);
  } catch (error) {
    console.error("[audit-log] failed to persist event", error);
  }
};

export const listAuditLogs = async (query: AuditLogQuery = {}): Promise<AdminAuditLogsResponse> => {
  const limit =
    typeof query.limit === "number" && Number.isFinite(query.limit)
      ? Math.min(Math.max(Math.floor(query.limit), 1), MAX_LIMIT)
      : DEFAULT_LIMIT;
  const filter: Record<string, string> = {};
  if (query.action) filter.action = query.action;
  if (query.actorRole) filter.actorRole = query.actorRole;
  if (query.clinicId) filter.clinicId = query.clinicId;
  if (query.patientId) filter.patientId = query.patientId;
  if (query.appointmentId) filter.appointmentId = query.appointmentId;

  const collection = await getAuditLogsCollection();
  const rows = await collection.find(filter).sort({ createdAt: -1 }).toArray();
  return {
    logs: rows.slice(0, limit).map((row) => serializeAuditLog(row as AuditLog)),
    limit,
  };
};
