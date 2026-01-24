import { useQuery } from "@tanstack/react-query";
import type {
  ClinicDoctorsResponse,
  ClinicListResponse,
  ClinicProfile,
  ClinicProfileResponse,
  ClinicDoctor,
} from "@shared/api";
import { CLINICS } from "./clinics";
import { DOCTORS } from "./doctors";

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
};

const fallbackDoctors = DOCTORS.map((doctor) => ({
  ...doctor,
  availability: doctor.nextAvailable,
})) as ClinicDoctor[];
const fallbackSpecializations = fallbackDoctors.reduce((map, doctor) => {
  const specialization = doctor.specialization.trim();
  if (!specialization) return map;
  const existing = map.get(doctor.clinicId) ?? new Set<string>();
  existing.add(specialization);
  map.set(doctor.clinicId, existing);
  return map;
}, new Map<string, Set<string>>());

const fallbackClinics = (CLINICS as ClinicProfile[]).map((clinic) => ({
  ...clinic,
  specializations: Array.from(fallbackSpecializations.get(clinic.id) ?? []).sort((a, b) =>
    a.localeCompare(b),
  ),
}));

export const useClinics = () =>
  useQuery<ClinicListResponse>({
    queryKey: ["clinics"],
    queryFn: () => fetchJson<ClinicListResponse>("/api/clinics"),
    initialData: { clinics: fallbackClinics },
  });

export const useClinicProfile = (clinicId?: string) => {
  const fallbackClinic = clinicId ? fallbackClinics.find((clinic) => clinic.id === clinicId) : undefined;
  return useQuery<ClinicProfileResponse>({
    queryKey: ["clinic", clinicId],
    queryFn: () => fetchJson<ClinicProfileResponse>(`/api/clinics/${clinicId}`),
    enabled: Boolean(clinicId),
    initialData: fallbackClinic ? { clinic: fallbackClinic } : undefined,
  });
};

export const useClinicDoctors = (clinicId?: string) =>
  useQuery<ClinicDoctorsResponse>({
    queryKey: ["clinic-doctors", clinicId],
    queryFn: () => fetchJson<ClinicDoctorsResponse>(`/api/clinics/${clinicId}/doctors`),
    enabled: Boolean(clinicId),
    initialData: clinicId
      ? {
          doctors: fallbackDoctors.filter((doctor) => doctor.clinicId === clinicId),
        }
      : undefined,
  });

export const useAllDoctors = () =>
  useQuery<ClinicDoctorsResponse>({
    queryKey: ["all-doctors"],
    queryFn: () => fetchJson<ClinicDoctorsResponse>("/api/clinics/doctors"),
    initialData: { doctors: fallbackDoctors },
  });

export const findClinicById = (clinics: ClinicProfile[], clinicId: string | null) =>
  clinics.find((clinic) => clinic.id === clinicId) ?? null;
