export type Clinic = {
  id: string;
  name: string;
  type: "Hospital" | "Clinic";
  rating: number;
  patients: string;
  distance: string;
  location: string;
  image: string;
  specializations: string[];
  nextAvailability: string;
  googlePlaceId?: string;
};
    id: "harbor-oncology",
    name: "Harbor Oncology Institute",
    type: "Hospital",
    rating: 4.8,
    patients: "9.1K patients",
    distance: "16 km away",
    location: "Oita Waterfront",
    image:
      "https://images.unsplash.com/photo-1580281657525-3b2420e98b1c?auto=format&fit=crop&w=800&q=80",
    specializations: ["Oncology"],
    nextAvailability: "Tomorrow, 12:10 PM",
  },
  {
    id: "mountain-pulm",
    name: "Mountain Air Pulmonary Clinic",
    type: "Clinic",
    rating: 4.5,
    patients: "1.9K patients",
    distance: "11 km away",
    location: "Tsukahara Highlands",
    image:
      "https://images.unsplash.com/photo-1448932223592-d1fc686e76ea?auto=format&fit=crop&w=800&q=80",
    specializations: ["Pulmonology"],
    nextAvailability: "Tomorrow, 9:15 AM",
  },
  {
    id: "riverside-rheum",
    name: "Riverside Rheumatology",
    type: "Clinic",
    rating: 4.3,
    patients: "2.4K patients",
    distance: "6 km away",
    location: "Beppu Riverside",
    image:
      "https://images.unsplash.com/photo-1503437313881-503a91226402?auto=format&fit=crop&w=800&q=80",
    specializations: ["Rheumatology"],
    nextAvailability: "Today, 6:40 PM",
  },
  {
    id: "harbor-womens",
    name: "Harbor Women's Health",
    type: "Hospital",
    rating: 4.7,
    patients: "5.6K patients",
    distance: "5 km away",
    location: "Hamawaki, Beppu",
    image:
      "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80",
    specializations: [
      "Gynecology",
      "Obstetrics",
      "General Physician",
      "General Medicine",
    ],
    nextAvailability: "Today, 5:50 PM",
  },
  {
    id: "bayview-urology",
    name: "Bayview Urology Center",
    type: "Clinic",
    rating: 4.6,
    patients: "3.7K patients",
    distance: "13 km away",
    location: "Beppu Marina",
    image:
      "https://images.unsplash.com/photo-1505576399279-565b52d4ac71?auto=format&fit=crop&w=800&q=80",
    specializations: ["Urology", "Nephrology"],
    nextAvailability: "Tomorrow, 3:30 PM",
  },
];
