export const formatSlotForLanguage = (slot: string, language: string) => {
  if (language !== "ja") return slot;
  const match = slot.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return slot;
  const hours = Number(match[1]);
  const minutes = match[2];
  const period = match[3]?.toUpperCase();
  const normalizedHours =
    period === "PM" && hours < 12 ? hours + 12 : period === "AM" && hours === 12 ? 0 : hours;
  const displayHours = normalizedHours % 12 === 0 ? 12 : normalizedHours % 12;
  const prefix = normalizedHours < 12 ? "午前" : "午後";
  const minutesLabel = minutes === "00" ? "" : `${minutes}分`;
  return `${prefix}${displayHours}時${minutesLabel}`;
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
  if (language !== "ja") return availability;
  let result = availability;
  result = result.replace(/\bToday\b/gi, translate("Today"));
  result = result.replace(/\bTomorrow\b/gi, translate("Tomorrow"));
  result = result.replace(/(\d{1,2}):(\d{2})\s*(AM|PM)/gi, (_match, hours, minutes, period) =>
    formatSlotForLanguage(`${hours}:${minutes} ${period}`, language),
  );
  result = result.replace(/(\d{1,2}):(\d{2})/g, (_match, hours, minutes) =>
    format24HourTime(hours, minutes),
  );
  return result;
};
