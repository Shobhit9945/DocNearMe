export type DoctorProfile = {
  id: string;
  name: string;
  clinicId: string;
  specialization: string;
  languages: string[];
  rating: number;
  nextAvailable: string;
};
