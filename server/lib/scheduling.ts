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

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

const formatDateKey = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const toJstDate = (date: Date) => new Date(date.getTime() + JST_OFFSET_MS);

export const parseDateKey = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
      return new Date(year, month - 1, day);
    }
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

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

export const getDateKey = (date: Date) => {
  const jst = toJstDate(date);
  return formatDateKey(jst.getUTCFullYear(), jst.getUTCMonth() + 1, jst.getUTCDate());
};

export const getJstNowMinutes = () => {
  const jst = toJstDate(new Date());
  return jst.getUTCHours() * 60 + jst.getUTCMinutes();
};

export const getJstMinutesFromDate = (date: Date) => {
  const jst = toJstDate(date);
  return jst.getUTCHours() * 60 + jst.getUTCMinutes();
};

export const parseSlotLabelToMinutes = (slotLabel: string) => {
  const match = slotLabel.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3].toUpperCase();
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  let adjustedHours = hours % 12;
  if (period === "PM") adjustedHours += 12;
  return adjustedHours * 60 + minutes;
};

export const isSlotInFutureJst = (
  dateKey: string,
  slotLabel: string,
  now: Date = new Date(),
  fallbackDate?: Date,
) => {
  const todayKey = getDateKey(now);
  if (dateKey < todayKey) return false;
  if (dateKey > todayKey) return true;
  const nowMinutes = getJstMinutesFromDate(now);
  const slotMinutes =
    parseSlotLabelToMinutes(slotLabel) ?? (fallbackDate ? getJstMinutesFromDate(fallbackDate) : null);
  if (slotMinutes === null) return false;
  return slotMinutes > nowMinutes;
};

const resolveTimeMinutes = (time?: string) => (time ? timeToMinutes(time) : null);

const buildClosureWindow = (
  dateKey: string,
  closure: ClinicInfo["bookingClosures"][number],
) => {
  const startDate = closure.startDate;
  const endDate = closure.endDate || closure.startDate;
  if (dateKey < startDate || dateKey > endDate) return null;

  const startTimeMinutes = resolveTimeMinutes(closure.startTime);
  const endTimeMinutes = resolveTimeMinutes(closure.endTime);
  const hasTimeRange =
    typeof startTimeMinutes === "number" && typeof endTimeMinutes === "number" && endTimeMinutes > startTimeMinutes;

  if (startDate === endDate) {
    if (!hasTimeRange) {
      return { fullDay: true, reason: closure.reason?.trim() || "Clinic closed" };
    }
    return { fullDay: false, startMinutes: startTimeMinutes, endMinutes: endTimeMinutes, reason: closure.reason };
  }

  if (dateKey > startDate && dateKey < endDate) {
    return { fullDay: true, reason: closure.reason?.trim() || "Clinic closed" };
  }

  if (dateKey === startDate) {
    if (!hasTimeRange) {
      return { fullDay: true, reason: closure.reason?.trim() || "Clinic closed" };
    }
    return {
      fullDay: false,
      startMinutes: startTimeMinutes,
      endMinutes: 24 * 60,
      reason: closure.reason,
    };
  }

  if (dateKey === endDate) {
    if (!hasTimeRange) {
      return { fullDay: true, reason: closure.reason?.trim() || "Clinic closed" };
    }
    return { fullDay: false, startMinutes: 0, endMinutes: endTimeMinutes, reason: closure.reason };
  }

  return null;
};

const getSlotMinutes = (date: Date, slotLabel: string) => {
  const slotDate = getSlotDateTime(date, slotLabel);
  if (!slotDate) return null;
  return slotDate.getHours() * 60 + slotDate.getMinutes();
};

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
    const window = buildClosureWindow(dateKey, closure);
    return window?.fullDay;
  });
  if (match) {
    return {
      closed: true,
      reason: match.reason?.trim() || "Clinic closed",
    };
  }
  return { closed: false, reason: "" };
};

export const applyBookingClosuresToSlots = (
  date: Date,
  slots: string[],
  closures?: ClinicInfo["bookingClosures"],
) => {
  if (!closures || closures.length === 0) return { slots, isClosed: false, reason: "" };
  const dateKey = getDateKey(date);
  let filteredSlots = [...slots];
  let closureReason = "";

  for (const closure of closures) {
    const window = buildClosureWindow(dateKey, closure);
    if (!window) continue;
    if (window.fullDay) {
      return { slots: [], isClosed: true, reason: window.reason ?? "Clinic closed" };
    }
    const startMinutes = window.startMinutes ?? 0;
    const endMinutes = window.endMinutes ?? 0;
    if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) continue;
    filteredSlots = filteredSlots.filter((slot) => {
      const minutes = getSlotMinutes(date, slot);
      if (minutes === null) return true;
      return minutes < startMinutes || minutes >= endMinutes;
    });
    if (!closureReason && window.reason) {
      closureReason = window.reason;
    }
  }

  if (filteredSlots.length === 0) {
    return { slots: [], isClosed: true, reason: closureReason || "Clinic closed" };
  }

  return { slots: filteredSlots, isClosed: false, reason: "" };
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
