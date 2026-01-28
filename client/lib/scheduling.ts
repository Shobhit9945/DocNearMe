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

export const getDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const resolveTimeMinutes = (time?: string) => {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

const isFullDayClosure = (dateKey: string, closure: ClinicBookingClosure) => {
  const start = closure.startDate;
  const end = closure.endDate || closure.startDate;
  if (dateKey < start || dateKey > end) return false;
  const startMinutes = resolveTimeMinutes(closure.startTime);
  const endMinutes = resolveTimeMinutes(closure.endTime);
  const hasTimeRange =
    typeof startMinutes === "number" && typeof endMinutes === "number" && endMinutes > startMinutes;

  if (start === end) {
    return !hasTimeRange;
  }
  if (dateKey > start && dateKey < end) {
    return true;
  }
  if (dateKey === start) {
    return !hasTimeRange;
  }
  if (dateKey === end) {
    return !hasTimeRange;
  }
  return false;
};

export const isDateWithinClosure = (date: Date, closures: ClinicBookingClosure[]) => {
  const dateKey = getDateKey(date);
  return closures.find((closure) => isFullDayClosure(dateKey, closure));
};
