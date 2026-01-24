import type { ClinicBookingClosure, ClinicHours } from "@shared/api";

export type NormalizedClinicHours = {
  weekdays: { start: string; end: string };
  weekend: { start: string; end: string };
  closedDays: string[];
  slotMinutes: number;
};

export const DEFAULT_CLINIC_HOURS: NormalizedClinicHours = {
  weekdays: { start: "09:00", end: "18:00" },
  weekend: { start: "10:00", end: "16:00" },
  closedDays: [],
  slotMinutes: 30,
};

const parseRangeString = (value: string) => {
  const match = value.trim().match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
  if (!match) return null;
  return { start: match[1], end: match[2] };
};

const normalizeDailyHours = (
  value: ClinicHours["weekdays"] | ClinicHours["weekend"] | string | undefined,
  fallback: { start: string; end: string },
) => {
  if (value && typeof value === "object" && "start" in value && "end" in value) {
    return { start: value.start, end: value.end };
  }
  if (typeof value === "string") {
    const parsed = parseRangeString(value);
    if (parsed) return parsed;
  }
  return fallback;
};

const normalizeClosedDays = (value: ClinicHours["closedDays"] | string | undefined) => {
  if (Array.isArray(value)) {
    return value.map((day) => day.trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((day) => day.trim())
      .filter(Boolean);
  }
  return [];
};

export const normalizeClinicHours = (hours?: ClinicHours | null): NormalizedClinicHours => {
  if (!hours) return { ...DEFAULT_CLINIC_HOURS };
  return {
    weekdays: normalizeDailyHours(hours.weekdays, DEFAULT_CLINIC_HOURS.weekdays),
    weekend: normalizeDailyHours(hours.weekend, DEFAULT_CLINIC_HOURS.weekend),
    closedDays: normalizeClosedDays(hours.closedDays),
    slotMinutes: hours.slotMinutes ?? 30,
  };
};

export const getDateKey = (date: Date) => date.toISOString().split("T")[0];

export const isDateWithinClosure = (date: Date, closures: ClinicBookingClosure[]) => {
  const dateKey = getDateKey(date);
  return closures.find((closure) => {
    const start = closure.startDate;
    const end = closure.endDate || closure.startDate;
    return start <= dateKey && dateKey <= end;
  });
};
