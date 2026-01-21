export type DoctorProfile = {
  id: string;
  name: string;
  clinicId: string;
  specialization: string;
  languages: string[];
  rating: number;
  nextAvailable: string;
};

export const DOCTORS: DoctorProfile[] = [
  {
    id: "dr-ayanami",
    name: "Dr. Riko Ayanami",
    clinicId: "noguchi",
    specialization: "Cardiology",
    languages: ["Japanese", "English"],
    rating: 4.7,
    nextAvailable: "Today, 4:30 PM",
  },
  {
    id: "dr-carter",
    name: "Dr. Lina Carter",
    clinicId: "noguchi",
    specialization: "Cardiology",
    languages: ["English", "Korean"],
    rating: 4.5,
    nextAvailable: "Today, 6:00 PM",
  },
  {
    id: "dr-watanabe",
    name: "Dr. Taro Watanabe",
    clinicId: "beppu-medical",
    specialization: "Cardiology",
    languages: ["Japanese", "English"],
    rating: 4.8,
    nextAvailable: "Tomorrow, 9:15 AM",
  },
  {
    id: "dr-chen",
    name: "Dr. Mei Chen",
    clinicId: "beppu-medical",
    specialization: "Dermatology",
    languages: ["Mandarin", "English"],
    rating: 4.6,
    nextAvailable: "Today, 5:10 PM",
  },
  {
    id: "dr-sato",
    name: "Dr. Haru Sato",
    clinicId: "harbor-derma",
    specialization: "Dermatology",
    languages: ["Japanese", "English"],
    rating: 4.4,
    nextAvailable: "Tomorrow, 1:15 PM",
  },
  {
    id: "dr-park",
    name: "Dr. Eun Park",
    clinicId: "sakura-ortho",
    specialization: "Orthopedics",
    languages: ["English", "Korean"],
    rating: 4.9,
    nextAvailable: "Tomorrow, 9:40 AM",
  },
  {
    id: "dr-harrison",
    name: "Dr. Caleb Harrison",
    clinicId: "sakura-ortho",
    specialization: "Sports Medicine",
    languages: ["English", "Spanish"],
    rating: 4.6,
    nextAvailable: "Tomorrow, 11:20 AM",
  },
  {
    id: "dr-mori",
    name: "Dr. Aya Mori",
    clinicId: "ap-house-family",
    specialization: "General Medicine",
    languages: ["Japanese", "English"],
    rating: 4.3,
    nextAvailable: "Today, 5:20 PM",
  },
  {
    id: "dr-alvarez",
    name: "Dr. Sofia Alvarez",
    clinicId: "harbor-womens",
    specialization: "Gynecology",
    languages: ["English", "Spanish"],
    rating: 4.8,
    nextAvailable: "Today, 5:50 PM",
  },
];
