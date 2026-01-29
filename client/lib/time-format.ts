const LANGUAGE_LOCALE_MAP: Record<string, string> = {
  en: "en-US",
  ja: "ja-JP",
  id: "id-ID",
  my: "my-MM",
  bn: "bn-BD",
  ar: "ar",
  hi: "hi-IN",
  fil: "fil-PH",
  th: "th-TH",
  zh: "zh-CN",
  ko: "ko-KR",
  "es-MX": "es-MX",
  vi: "vi-VN",
  es: "es-ES",
};

export const getLocaleForLanguage = (language: string) => LANGUAGE_LOCALE_MAP[language] ?? "en-US";

const parseSlotToDate = (slot: string) => {
  const match = slot.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  const period = match[3]?.toUpperCase();
  const normalizedHours =
    period === "PM" && hours < 12 ? hours + 12 : period === "AM" && hours === 12 ? 0 : hours;
  const date = new Date();
  date.setHours(normalizedHours, minutes, 0, 0);
  return date;
};

export const formatSlotForLanguage = (slot: string, language: string) => {
  const parsed = parseSlotToDate(slot);
  if (!parsed) return slot;

  if (language === "ja") {
    const hours = parsed.getHours();
    const minutes = String(parsed.getMinutes()).padStart(2, "0");
    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
    const prefix = hours < 12 ? "午前" : "午後";
    const minutesLabel = minutes === "00" ? "" : `${minutes}分`;
    return `${prefix}${displayHours}時${minutesLabel}`;
  }

  const locale = getLocaleForLanguage(language);
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
};

const format24HourTime = (hoursValue: string, minutesValue: string) => {
  const hours = Number(hoursValue);
  if (Number.isNaN(hours)) return `${hoursValue}:${minutesValue}`;
  const minutesLabel = minutesValue === "00" ? "" : `${minutesValue}分`;
  return `${hours}時${minutesLabel}`;
};

export const formatAvailabilityForLanguage = (
  availability: string,
  language: string,
  translate: (key: string, fallback?: string) => string,
) => {
  let result = availability;
  result = result.replace(/\bToday\b/gi, translate("Today"));
  result = result.replace(/\bTomorrow\b/gi, translate("Tomorrow"));

  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const shortDayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  dayNames.forEach((day) => {
    result = result.replace(new RegExp(`\\b${day}\\b`, "g"), translate(day));
  });
  shortDayNames.forEach((day) => {
    result = result.replace(new RegExp(`\\b${day}\\b`, "g"), translate(day));
  });
  monthNames.forEach((month) => {
    result = result.replace(new RegExp(`\\b${month}\\b`, "g"), translate(month));
  });

  result = result.replace(/(\d{1,2}):(\d{2})\s*(AM|PM)/gi, (_match, hours, minutes, period) =>
    formatSlotForLanguage(`${hours}:${minutes} ${period}`, language),
  );
  result = result.replace(/(\d{1,2}):(\d{2})/g, (_match, hours, minutes) =>
    language === "ja" ? format24HourTime(hours, minutes) : formatSlotForLanguage(`${hours}:${minutes}`, language),
  );

  return result;
};
