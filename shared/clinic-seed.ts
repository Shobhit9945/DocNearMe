import { ClinicDoctor, ClinicProfile } from "./api";

const defaultHours = {
  weekdays: { start: "09:00", end: "18:00" },
  weekend: { start: "10:00", end: "14:00" },
  closedDays: ["Wednesday"],
  slotMinutes: 30,
};

const defaultPricing = {
  firstVisit: "¥3,000",
  followUp: "¥1,500",
  otherServices: "PCR test ¥6,000, Vaccination ¥4,500",
import type { ClinicDoctor, ClinicProfile } from "./api";

export const CLINIC_SEED: ClinicProfile[] = [];
export const DOCTOR_SEED: ClinicDoctor[] = [];
  { label: "Reception", url: image },
