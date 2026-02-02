import { useQuery } from "@tanstack/react-query";
import type {
  ClinicDoctorsResponse,
  ClinicListResponse,
  ClinicProfile,
  ClinicProfileResponse,
  ClinicDoctor,
} from "@shared/api";

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
};

export const useClinics = () =>
  useQuery<ClinicListResponse>({
    queryKey: ["clinics"],
    queryFn: () => fetchJson<ClinicListResponse>("/api/clinics"),
  });

export const useClinicProfile = (clinicId?: string) => {
  return useQuery<ClinicProfileResponse>({
    queryKey: ["clinic", clinicId],
    queryFn: () => fetchJson<ClinicProfileResponse>(`/api/clinics/${clinicId}`),
    enabled: Boolean(clinicId),
  });
};

export const useClinicDoctors = (clinicId?: string) =>
  useQuery<ClinicDoctorsResponse>({
    queryKey: ["clinic-doctors", clinicId],
    queryFn: () => fetchJson<ClinicDoctorsResponse>(`/api/clinics/${clinicId}/doctors`),
    enabled: Boolean(clinicId),
    staleTime: 0,
    refetchOnMount: "always",
  });

export const useAllDoctors = () =>
  useQuery<ClinicDoctorsResponse>({
    queryKey: ["all-doctors"],
    queryFn: () => fetchJson<ClinicDoctorsResponse>("/api/clinics/doctors"),
  });

export const findClinicById = (clinics: ClinicProfile[], clinicId: string | null) =>
  clinics.find((clinic) => clinic.id === clinicId) ?? null;
