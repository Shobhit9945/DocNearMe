import { z } from "zod";

export type ClinicClosureInput = {
  startDate: string;
  endDate?: string | null;
  reason?: string | null;
};

const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const clinicClosureInputSchema = z.object({
  startDate: dateKeySchema,
  endDate: dateKeySchema.optional().or(z.literal("")).optional(),
  reason: z.string().trim().max(200).optional(),
});

export const normalizeClosureDateKey = (value: string) => value.trim();

export const validateClinicClosureDates = (input: ClinicClosureInput) => {
  const parsed = clinicClosureInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "invalid_date" };
  }

  const startDate = normalizeClosureDateKey(parsed.data.startDate);
  const endDateRaw = parsed.data.endDate ? normalizeClosureDateKey(parsed.data.endDate) : "";
  const endDate = endDateRaw || startDate;

  if (endDate < startDate) {
    return { ok: false as const, error: "end_before_start" };
  }

  return { ok: true as const, startDate, endDate };
};

export const formatDateKeyToJp = (value: string) => value.replace(/-/g, "/");
