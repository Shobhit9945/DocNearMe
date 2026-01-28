import { Request, Response } from "express";
import { z } from "zod";
import { getClinicIntakeFormsCollection } from "../db";
import type { ClinicIntakeForm, IntakeQuestion } from "../types";

const QUESTION_TYPES = [
  "short-text",
  "long-text",
  "single-choice",
  "multiple-choice",
  "number",
  "date",
  "boolean",
  "file",
 ] as const;

const DATA_TYPES = ["string", "number", "date", "boolean", "email", "phone", "file"] as const;

const DELIVERY_TIMINGS = ["booking", "reminder", "checkin"] as const;

const questionSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1).max(200),
  description: z.string().trim().max(400).optional().or(z.literal("")),
  questionType: z.enum(QUESTION_TYPES),
  dataType: z.enum(DATA_TYPES),
  required: z.boolean(),
  options: z.array(z.string().trim().min(1).max(120)).optional().default([]),
});

const intakeFormSchema = z.object({
  isRequired: z.boolean(),
  deliveryTiming: z.enum(DELIVERY_TIMINGS),
  questions: z.array(questionSchema).default([]),
});

const parseRequestBody = (body: unknown): unknown => {
  if (body instanceof Buffer) {
    return parseRequestBody(body.toString("utf8"));
  }
  if (body instanceof Uint8Array) {
    return parseRequestBody(Buffer.from(body).toString("utf8"));
  }
  if (body && typeof body === "object") return body;
  if (typeof body !== "string") return {};

  const trimmed = body.trim();
  if (!trimmed) return {};

  try {
    return JSON.parse(trimmed);
  } catch {
    const params = new URLSearchParams(trimmed);
    const payload: Record<string, string> = {};
    params.forEach((value, key) => {
      payload[key] = value;
    });
    return payload;
  }
};

type IntakeQuestionPayload = z.infer<typeof questionSchema>;

const sanitizeQuestions = (questions: IntakeQuestionPayload[]): IntakeQuestion[] =>
  questions.map((question) => ({
    ...question,
    description: question.description?.trim() ?? "",
    options: Array.isArray(question.options) ? question.options.map((option) => option.trim()).filter(Boolean) : [],
  }));

export const handleGetClinicIntakeForm = async (req: Request, res: Response) => {
  const clinicId = req.params.clinicId;
  if (!clinicId) {
    return res.status(400).json({ error: "Clinic id is required." });
  }

  try {
    const intakeForms = await getClinicIntakeFormsCollection();
    const form = await intakeForms.findOne({ clinicId });
    if (!form) {
      return res.json({ form: null });
    }
    return res.json({
      form: {
        clinicId: form.clinicId,
        isRequired: form.isRequired,
        deliveryTiming: form.deliveryTiming,
        questions: sanitizeQuestions(form.questions),
        updatedAt: form.updatedAt instanceof Date ? form.updatedAt.toISOString() : form.updatedAt,
      },
    });
  } catch (error) {
    console.error("Clinic intake form fetch error", error);
    return res.status(500).json({ error: "Unable to load intake form." });
  }
};

export const handleGetClinicIntakeFormForClinic = async (req: Request, res: Response) => {
  if (!req.clinicAuth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const intakeForms = await getClinicIntakeFormsCollection();
    const form = await intakeForms.findOne({ clinicId: req.clinicAuth.clinicId });
    if (!form) {
      return res.json({ form: null });
    }
    return res.json({
      form: {
        clinicId: form.clinicId,
        isRequired: form.isRequired,
        deliveryTiming: form.deliveryTiming,
        questions: sanitizeQuestions(form.questions),
        updatedAt: form.updatedAt instanceof Date ? form.updatedAt.toISOString() : form.updatedAt,
      },
    });
  } catch (error) {
    console.error("Clinic intake form fetch error", error);
    return res.status(500).json({ error: "Unable to load intake form." });
  }
};

export const handleUpdateClinicIntakeForm = async (req: Request, res: Response) => {
  if (!req.clinicAuth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const payload = parseRequestBody(req.body);
  const parsed = intakeFormSchema.safeParse(payload);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid intake form payload." });
  }

  const clinicId = req.clinicAuth.clinicId;
  const now = new Date();
  const questions = sanitizeQuestions(parsed.data.questions);
  const formPayload: ClinicIntakeForm = {
    clinicId,
    isRequired: parsed.data.isRequired,
    deliveryTiming: parsed.data.deliveryTiming,
    questions,
    updatedAt: now,
  };

  try {
    const intakeForms = await getClinicIntakeFormsCollection();
    const existing = await intakeForms.findOne({ clinicId });
    if (existing) {
      await intakeForms.updateOne({ clinicId }, { $set: formPayload });
    } else {
      await intakeForms.insertOne(formPayload);
    }

    return res.json({
      success: true,
      form: {
        clinicId,
        isRequired: formPayload.isRequired,
        deliveryTiming: formPayload.deliveryTiming,
        questions: formPayload.questions,
        updatedAt: now.toISOString(),
      },
    });
  } catch (error) {
    console.error("Clinic intake form update error", error);
    return res.status(500).json({ error: "Unable to save intake form." });
  }
};
