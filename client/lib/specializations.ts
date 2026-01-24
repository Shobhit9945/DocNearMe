export type SpecializationOption = {
  id: string;
  label: string;
  aliases?: string[];
};

export const SPECIALIZATION_OPTIONS: SpecializationOption[] = [
  {
    id: "General Physician",
    label: "General Medicine",
    aliases: ["General Medicine", "Primary Care", "Family Medicine"],
  },
  {
    id: "Internal Medicine",
    label: "Internal Medicine",
    aliases: ["Internist"],
  },
  { id: "Cardiologist", label: "Cardiology", aliases: ["Cardiology"] },
  { id: "Dermatologist", label: "Dermatology", aliases: ["Dermatology"] },
  {
    id: "Pediatrician",
    label: "Pediatrics",
    aliases: ["Pediatrics", "Pediatric"],
  },
  {
    id: "Orthopedic Surgeon",
    label: "Orthopedics",
    aliases: ["Orthopedics", "Orthopedic", "Ortho"],
  },
  { id: "Gastroenterology", label: "Gastroenterology" },
  { id: "Neurology", label: "Neurology" },
  { id: "Psychiatry", label: "Psychiatry" },
  { id: "Psychology", label: "Psychology", aliases: ["Therapy", "Counseling"] },
  { id: "Ophthalmology", label: "Ophthalmology", aliases: ["Eye"] },
  { id: "Endocrinology", label: "Endocrinology" },
  { id: "Oncology", label: "Oncology" },
  { id: "Pulmonology", label: "Pulmonology", aliases: ["Pulmonary"] },
  { id: "Rheumatology", label: "Rheumatology" },
  {
    id: "Allergy & Immunology",
    label: "Allergy & Immunology",
    aliases: ["Allergy", "Immunology", "Allergist"],
  },
  {
    id: "Nephrology",
    label: "Nephrology",
    aliases: ["Renal Medicine", "Kidney"],
  },
  { id: "ENT", label: "ENT / Otolaryngology", aliases: ["Otolaryngology"] },
  { id: "Gynecology", label: "Gynecology" },
  {
    id: "Obstetrics",
    label: "Obstetrics",
    aliases: ["OBGYN", "OB-GYN", "Obstetrics & Gynecology"],
  },
  { id: "Urology", label: "Urology" },
  {
    id: "Sports Medicine",
    label: "Sports Medicine",
    aliases: ["Sports Injury"],
  },
  {
    id: "Physical Therapy",
    label: "Physical Therapy",
    aliases: ["Physiotherapy", "Rehab", "Rehabilitation"],
  },
];

export const SPECIALIZATION_IDS = SPECIALIZATION_OPTIONS.map((spec) => spec.id);

const aliasToId = new Map<string, string>();

SPECIALIZATION_OPTIONS.forEach(({ id, label, aliases = [] }) => {
  [id, label, ...aliases].forEach((alias) => {
    aliasToId.set(alias.toLowerCase(), id);
  });
});

export const matchSpecialization = (input: string): string | null => {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return null;

  if (aliasToId.has(normalized)) {
    return aliasToId.get(normalized) ?? null;
  }

  for (const [alias, id] of aliasToId.entries()) {
    if (normalized.includes(alias) || alias.includes(normalized)) {
      return id;
    }
  }

  return null;
};

export const resolveSpecializationId = (
  input: string,
  fallbackId: string = SPECIALIZATION_OPTIONS[0]?.id ?? "General Physician"
): string => {
  const normalized = matchSpecialization(input);
  if (normalized) return normalized;

  const trimmed = input.trim();
  if (!trimmed) return fallbackId;

  const lower = trimmed.toLowerCase();
  if (lower === "other" || lower === "unsure") {
    return fallbackId;
  }

  return fallbackId;
};

export const getSpecializationLabel = (specialization: string): string => {
  const normalized = matchSpecialization(specialization) ?? specialization.trim();
  if (!normalized) return "";
  const option = SPECIALIZATION_OPTIONS.find((spec) => spec.id === normalized);
  return option?.label ?? normalized;
};
