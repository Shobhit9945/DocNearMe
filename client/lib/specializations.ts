export type SpecializationOption = {
  id: string;
  label: string;
};

export const buildSpecializationOptions = (specializations: string[]): SpecializationOption[] => {
  const unique = new Map<string, string>();
  specializations
    .map((spec) => spec.trim())
    .filter(Boolean)
    .forEach((spec) => {
      if (!unique.has(spec.toLowerCase())) {
        unique.set(spec.toLowerCase(), spec);
      }
    });

  return Array.from(unique.values())
    .map((spec) => ({ id: spec, label: spec }))
    .sort((a, b) => a.label.localeCompare(b.label));
};

export const matchSpecialization = (input: string, available?: string[]): string | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!available || available.length === 0) return trimmed;
  const lower = trimmed.toLowerCase();
  const found = available.find((spec) => spec.toLowerCase() === lower);
  return found ?? trimmed;
};

export const resolveSpecializationId = (
  input: string,
  fallbackId: string = ""
): string => {
  const normalized = matchSpecialization(input);
  if (normalized) return normalized;
  return fallbackId;
};

export const getSpecializationLabel = (specialization: string): string => {
  const normalized = matchSpecialization(specialization) ?? specialization.trim();
  return normalized ?? "";
};
