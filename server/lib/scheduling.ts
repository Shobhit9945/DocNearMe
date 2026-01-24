import type { ClinicInfo } from "../types";

type DailyHours = {
  start: string;
  end: string;
};

export type NormalizedClinicHours = {
  weekdays: DailyHours;
  weekend: DailyHours;
  closedDays: string[];
  slotMinutes: number;
};

export const DEFAULT_CLINIC_HOURS: NormalizedClinicHours = {
  weekdays: { start: "09:00", end: "18:00" },
  weekend: { start: "10:00", end: "16:00" },
  closedDays: [],
  slotMinutes: 30,
};

const dayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "long" });

const parseRangeString = (value: string): DailyHours | null => {
  const match = value.trim().match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
  if (!match) return null;
  return { start: match[1], end: match[2] };
};

const normalizeDailyHours = (value: unknown, fallback: DailyHours): DailyHours => {
  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>;
    if (typeof candidate.start === "string" && typeof candidate.end === "string") {
      return { start: candidate.start, end: candidate.end };
    }
  }
  if (typeof value === "string") {
    const parsed = parseRangeString(value);
    if (parsed) return parsed;
  }
  return fallback;
};

const normalizeClosedDays = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((day) => String(day).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((day) => day.trim())
      .filter(Boolean);
  }
  return [];
};

export const normalizeClinicHours = (hours?: ClinicInfo["hours"] | null): NormalizedClinicHours => {
  if (!hours) return { ...DEFAULT_CLINIC_HOURS };

  return {
    weekdays: normalizeDailyHours(hours.weekdays, DEFAULT_CLINIC_HOURS.weekdays),
    weekend: normalizeDailyHours(hours.weekend, DEFAULT_CLINIC_HOURS.weekend),
    closedDays: normalizeClosedDays(hours.closedDays),
    slotMinutes: typeof hours.slotMinutes === "number" && hours.slotMinutes > 0 ? hours.slotMinutes : 30,
  };
};

const timeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

const formatSlotLabel = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const date = new Date();
  date.setHours(hours, mins, 0, 0);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

export const buildSlotsForDate = (date: Date, hours: NormalizedClinicHours): string[] => {
  const day = date.getDay();
  const schedule = day === 0 || day === 6 ? hours.weekend : hours.weekdays;
  const startMinutes = timeToMinutes(schedule.start);
  const endMinutes = timeToMinutes(schedule.end);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return [];

  const slots: string[] = [];
  for (let minutes = startMinutes; minutes + hours.slotMinutes <= endMinutes; minutes += hours.slotMinutes) {
    slots.push(formatSlotLabel(minutes));
  }
  return slots;
};

export const getDateKey = (date: Date) => date.toISOString().split("T")[0];

export const isClinicClosedOnDate = (
  date: Date,
  hours: NormalizedClinicHours,
  closures?: ClinicInfo["bookingClosures"],
) => {
  const dayName = dayFormatter.format(date);
  if (hours.closedDays.some((day) => day.toLowerCase() === dayName.toLowerCase())) {
    return {
      closed: true,
      reason: `Closed on ${dayName}`,
    };
  }
  const dateKey = getDateKey(date);
  const match = (closures ?? []).find((closure) => {
    const start = closure.startDate;
    const end = closure.endDate || closure.startDate;
    return start <= dateKey && dateKey <= end;
  });
  if (match) {
    return {
      closed: true,
      reason: match.reason?.trim() || "Clinic closed",
    };
  }
  return { closed: false, reason: "" };
};

export const buildNextAvailabilityLabel = (
  date: Date,
  slotLabel: string,
  locale = "en-US",
) => {
  const todayKey = getDateKey(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = getDateKey(tomorrow);
  const dateKey = getDateKey(date);

  if (dateKey === todayKey) {
    return `Today, ${slotLabel}`;
  }
  if (dateKey === tomorrowKey) {
    return `Tomorrow, ${slotLabel}`;
  }
  const label = date.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" });
  return `${label}, ${slotLabel}`;
};

export const getSlotDateTime = (date: Date, slotLabel: string) => {
  const [time, period] = slotLabel.split(" ");
  const [hoursText, minutesText] = time.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  const normalizedHours =
    period === "PM" && hours < 12 ? hours + 12 : period === "AM" && hours === 12 ? 0 : hours;
  const result = new Date(date);
  result.setHours(normalizedHours, minutes, 0, 0);
  return result;
};
