import { useMemo, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { DocDaisyBanner } from "@/components/DocDaisyBanner";
import { PageScaffold } from "@/components/PageScaffold";
import {
  Building2,
  CalendarClock,
  Filter,
  MapPin,
  Star,
  Users,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

const BASE_SPECIALIZATIONS = [
  { id: "Cardiologist", label: "Cardiology" },
  { id: "ENT", label: "ENT / Otolaryngology" },
  { id: "Dermatologist", label: "Dermatology" },
  { id: "General Physician", label: "General Medicine" },
  { id: "Pediatrician", label: "Pediatrics" },
  { id: "Orthopedic Surgeon", label: "Orthopedics" },
  { id: "Gastroenterology", label: "Gastroenterology" },
  { id: "Neurology", label: "Neurology" },
  { id: "Psychiatry", label: "Psychiatry" },
  { id: "Ophthalmology", label: "Ophthalmology" },
  { id: "Endocrinology", label: "Endocrinology" },
  { id: "Oncology", label: "Oncology" },
  { id: "Pulmonology", label: "Pulmonology" },
  { id: "Rheumatology", label: "Rheumatology" },
  { id: "Gynecology", label: "Gynecology" },
  { id: "Urology", label: "Urology" },
];

const CLINICS = [
  {
    id: "noguchi",
    name: "Noguchi Hospital",
    type: "Hospital",
    rating: 3.9,
    patients: "10K+ patients",
    distance: "12 km away",
    location: "Aoyamacho, Beppu",
    image:
      "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=800&q=80",
    specializations: [
      "Cardiologist",
      "Cardiology",
      "Gastroenterology",
      "Neurology",
      "Pulmonology",
      "General Physician",
      "General Medicine",
    ],
    nextAvailability: "Today, 4:30 PM",
  },
  {
    id: "beppu-medical",
    name: "Beppu Medical Center",
    type: "Clinic",
    rating: 4.5,
    patients: "4K+ patients",
    distance: "8 km away",
    location: "Beppu Station",
    image:
      "https://images.unsplash.com/photo-1504439468489-c8920d796a29?auto=format&fit=crop&w=800&q=80",
    specializations: [
      "Cardiologist",
      "Cardiology",
      "Dermatologist",
      "Dermatology",
      "Orthopedic Surgeon",
      "Orthopedics",
      "Endocrinology",
    ],
    nextAvailability: "Today, 6:10 PM",
  },
  {
    id: "oita-ent",
    name: "Oita ENT & Hearing",
    type: "Clinic",
    rating: 4.8,
    patients: "2.3K patients",
    distance: "6 km away",
    location: "Kitahama, Beppu",
    image:
      "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=800&q=80",
    specializations: ["ENT", "Otolaryngology", "Pulmonology"],
    nextAvailability: "Tomorrow, 10:00 AM",
  },
  {
    id: "harbor-derma",
    name: "Harbor Dermatology",
    type: "Clinic",
    rating: 4.2,
    patients: "1.1K patients",
    distance: "4 km away",
    location: "Minami Beppu",
    image:
      "https://images.unsplash.com/photo-1527613426441-4da17471b66d?auto=format&fit=crop&w=800&q=80",
    specializations: ["Dermatologist", "Dermatology"],
    nextAvailability: "Tomorrow, 1:15 PM",
  },
  {
    id: "ap-house-family",
    name: "AP House Family Care",
    type: "Hospital",
    rating: 4.1,
    patients: "7.2K patients",
    distance: "2 km away",
    location: "Jumonjibaru, Beppu",
    image:
      "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80",
    specializations: [
      "General Physician",
      "General Medicine",
      "Pediatrician",
      "Pediatrics",
      "Gynecology",
    ],
    nextAvailability: "Today, 5:20 PM",
  },
  {
    id: "sakura-ortho",
    name: "Sakura Ortho & Rehab",
    type: "Clinic",
    rating: 4.7,
    patients: "3.4K patients",
    distance: "10 km away",
    location: "Higashi Beppu",
    image:
      "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=800&q=80",
    specializations: [
      "Orthopedic Surgeon",
      "Orthopedics",
      "Rheumatology",
      "General Physician",
      "General Medicine",
    ],
    nextAvailability: "Tomorrow, 9:40 AM",
  },
  {
    id: "sunrise-peds",
    name: "Sunrise Children's Clinic",
    type: "Clinic",
    rating: 4.6,
    patients: "5.1K patients",
    distance: "5 km away",
    location: "Ishigaki, Beppu",
    image:
      "https://images.unsplash.com/photo-1484980972926-edee96e0960d?auto=format&fit=crop&w=800&q=80",
    specializations: ["Pediatrician", "Pediatrics"],
    nextAvailability: "Today, 3:00 PM",
  },
  {
    id: "bluewave-gastro",
    name: "Bluewave Digestive Center",
    type: "Clinic",
    rating: 4.4,
    patients: "3.1K patients",
    distance: "7 km away",
    location: "Beppu Bayfront",
    image:
      "https://images.unsplash.com/photo-1504439904031-93ded9f93e3c?auto=format&fit=crop&w=800&q=80",
    specializations: ["Gastroenterology"],
    nextAvailability: "Tomorrow, 11:20 AM",
  },
  {
    id: "beacon-neuro",
    name: "Beacon Neurology Institute",
    type: "Hospital",
    rating: 4.9,
    patients: "8.5K patients",
    distance: "14 km away",
    location: "Oita City",
    image:
      "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=800&q=80",
    specializations: ["Neurology"],
    nextAvailability: "Tomorrow, 2:00 PM",
  },
  {
    id: "serenity-mental",
    name: "Serenity Mental Health",
    type: "Clinic",
    rating: 4.3,
    patients: "2.8K patients",
    distance: "3 km away",
    location: "Downtown Beppu",
    image:
      "https://images.unsplash.com/photo-1526256262350-7da7584cf5eb?auto=format&fit=crop&w=800&q=80",
    specializations: ["Psychiatry", "Psychology"],
    nextAvailability: "Today, 7:15 PM",
  },
  {
    id: "clearview-eye",
    name: "Clearview Eye Hospital",
    type: "Hospital",
    rating: 4.6,
    patients: "6.7K patients",
    distance: "9 km away",
    location: "Kamegawa, Beppu",
    image:
      "https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=800&q=80",
    specializations: ["Ophthalmology"],
    nextAvailability: "Tomorrow, 8:45 AM",
  },
  {
    id: "koyo-endo",
    name: "Koyo Endocrine & Diabetes",
    type: "Clinic",
    rating: 4.4,
    patients: "2.9K patients",
    distance: "5 km away",
    location: "Kannawa, Beppu",
    image:
      "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=800&q=80",
    specializations: ["Endocrinology"],
    nextAvailability: "Today, 4:50 PM",
  },
  {
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
    specializations: ["Gynecology", "Obstetrics", "General Physician", "General Medicine"],
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

export default function Clinics() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const [facilityType, setFacilityType] = useState<"all" | "Hospital" | "Clinic">(
    "all"
  );
  const [minRating, setMinRating] = useState(0);

  const specializationParam = searchParams.get("specialization")?.trim();

  const availableSpecializations = useMemo(() => {
    if (!specializationParam) return BASE_SPECIALIZATIONS;

    const exists = BASE_SPECIALIZATIONS.some(
      (spec) => spec.id.toLowerCase() === specializationParam.toLowerCase()
    );

    return exists
      ? BASE_SPECIALIZATIONS
      : [...BASE_SPECIALIZATIONS, { id: specializationParam, label: specializationParam }];
  }, [specializationParam]);

  const selectedSpecialization =
    availableSpecializations.find(
      (spec) => spec.id.toLowerCase() === (specializationParam ?? "").toLowerCase()
    )?.id ?? availableSpecializations[0].id;

  const clinics = useMemo(
    () =>
      CLINICS.filter((clinic) =>
        clinic.specializations.some(
          (spec) => spec.toLowerCase() === selectedSpecialization.toLowerCase()
        )
      ),
    [selectedSpecialization]
  );

  const selectedLabel =
    availableSpecializations.find((spec) => spec.id === selectedSpecialization)?.label ?? selectedSpecialization;

  const handleSpecializationChange = (specialization: string) => {
    setSearchParams({ specialization });
    setShowFilters(false);
  };

  return (
    <PageScaffold contentClassName="pb-28 lg:pb-12">
      <header className="bg-white px-4 pt-10 pb-4 border-b border-gray-100 shadow-sm lg:px-10 lg:rounded-t-3xl lg:border-none lg:shadow-none">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Clinics & Hospitals</p>
          <h1 className="text-3xl font-bold text-[#002D55] flex items-center gap-3">
            <Building2 className="w-8 h-8 text-[#0089FF]" /> Discover care for {selectedLabel}
          </h1>
          <p className="text-sm text-slate-500">{clinics.length} options in Beppu updated just now based on your specialty.</p>
        </div>
      </header>

      <main className="flex-1 px-4 pt-6 lg:px-10 lg:pt-10">
        <div className="lg:grid lg:grid-cols-[2fr_1fr] lg:gap-8">
          <section className="space-y-6">
            <div className="rounded-3xl border border-[#D4EBFF] bg-gradient-to-br from-white to-[#E4F2FF] p-6 shadow-sm lg:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-[#002D55]">{selectedLabel} specialists near you</p>
                  <h2 className="text-2xl font-bold text-[#002D55]">
                    {clinics.length} care centers available in Beppu
                  </h2>
                  <p className="text-sm text-slate-600">Refined by DocDaisy and your latest filters.</p>
                </div>
                <div className="rounded-2xl bg-white/80 p-4 text-sm text-slate-600 shadow-sm">
                  <p className="font-semibold text-[#002D55]">Live location</p>
                  <p>AP House 5, Ritsumeikan APU</p>
                  <p className="text-xs text-slate-500 mt-2">Updated a moment ago</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowFilters((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-[#002D55] hover:border-[#3A12DB] hover:text-[#3A12DB] lg:hidden"
              >
                <Filter className="w-4 h-4" /> {showFilters ? "Hide" : "Show"} filters
              </button>
            </div>

            <div
              className={`${showFilters ? "grid" : "hidden lg:grid"} grid-cols-1 gap-4 border-t border-slate-100 px-4 py-4 sm:grid-cols-2 lg:grid-cols-3 lg:px-6 lg:py-6`}
            >
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="specialization">
                    Specialization
                  </label>
                  <select
                    id="specialization"
                    value={selectedSpecialization}
                    onChange={(e) => handleSpecializationChange(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-[#3A12DB] focus:outline-none"
                  >
                    {availableSpecializations.map((spec) => (
                      <option key={spec.id} value={spec.id}>
                        {spec.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-700">Facility type</p>
                  <div className="flex flex-wrap gap-2">
                    {["all", "Hospital", "Clinic"].map((type) => (
                      <button
                        key={type}
                        onClick={() => setFacilityType(type as typeof facilityType)}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition-all ${
                          facilityType === type
                            ? "border-[#3A12DB] bg-[#E5DEFF] text-[#3A12DB] shadow-sm"
                            : "border-slate-200 bg-slate-50 text-slate-600 hover:border-[#D4EBFF]"
                        }`}
                      >
                        {type === "all" ? "All" : type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="rating">
                    Minimum rating
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      id="rating"
                      type="range"
                      min={0}
                      max={5}
                      step={0.1}
                      value={minRating}
                      onChange={(e) => setMinRating(Number(e.target.value))}
                      className="flex-1 accent-[#3A12DB]"
                    />
                    <span className="flex items-center gap-1 rounded-full bg-[#F1EDFF] px-3 py-1 text-xs font-semibold text-[#3A12DB]">
                      <Star className="w-4 h-4" /> {minRating.toFixed(1)}+
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Drag to prioritise higher-rated doctors.</p>
                </div>
              </div>

            <div className="grid gap-5 md:grid-cols-2">
              {clinics.map((clinic) => {
                const visibleSpecializations = clinic.specializations.slice(0, 4);
                const remaining = clinic.specializations.length - visibleSpecializations.length;

                return (
                  <article
                    key={clinic.id}
                    className="flex h-full flex-col overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-[0_10px_35px_rgba(21,47,81,0.05)]"
                  >
                    <div className="h-40 w-full overflow-hidden">
                      <img src={clinic.image} alt={clinic.name} className="h-full w-full object-cover" />
                    </div>
                    <div className="flex flex-1 flex-col gap-4 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-400">{clinic.type}</p>
                          <h3 className="text-xl font-semibold text-[#002D55]">{clinic.name}</h3>
                        </div>
                        <div className="flex items-center gap-1 rounded-full bg-[#FFF3C8] px-3 py-1 text-sm font-semibold text-[#B06B00]">
                          <Star className="w-4 h-4" fill="#B06B00" /> {clinic.rating}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4 text-[#0089FF]" /> {clinic.patients}
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4 text-[#0089FF]" /> {clinic.location} · {clinic.distance}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs font-semibold text-[#3A12DB]">
                        {visibleSpecializations.map((spec) => (
                          <span key={spec} className="rounded-full bg-[#F1EDFF] px-3 py-1">
                            {spec}
                          </span>
                        ))}
                        {remaining > 0 && (
                          <span className="rounded-full bg-[#E4F2FF] px-3 py-1 text-[#1648CE]">+{remaining} more</span>
                        )}
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <CalendarClock className="w-4 h-4 text-[#0089FF]" /> Next availability: {clinic.nextAvailability}
                        </div>
                        <button
                          onClick={() => navigate(`/appointment?clinic=${clinic.id}&specialization=${encodeURIComponent(selectedSpecialization)}`)}
                          className="inline-flex items-center justify-center rounded-2xl bg-[#1648CE] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#1648CE]/30 transition-colors hover:bg-[#0F3499]"
                        >
                          Book appointment
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}

              {clinics.length === 0 && (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-8 text-center text-sm text-slate-500 md:col-span-2">
                  No clinics match this specialty yet. Try another selection or chat with DocDaisy.
                </div>
              )}
            </div>
          </section>

          <aside className="hidden lg:flex flex-col gap-5">
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-400">Why these clinics?</p>
              <h4 className="text-lg font-semibold text-[#002D55] mt-2">Curated with DocDaisy</h4>
              <p className="text-sm text-slate-600 mt-2">
                Your symptoms led to a recommendation for {selectedLabel}. We prioritise availability, distance and patient reviews.
              </p>
            </div>
            <DocDaisyBanner variant="card" onClick={() => navigate("/docdaisy")} />
            <div className="rounded-3xl border border-[#D4EBFF] bg-[#F5FAFF] p-6 text-sm text-slate-600">
              <p className="font-semibold text-[#002D55]">Need directions?</p>
              <p className="mt-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#0089FF]" /> Use in-app navigation once you confirm a slot.
              </p>
            </div>
          </aside>
        </div>
      </main>

      <div className="lg:hidden">
        <BottomNav />
      </div>
    </PageScaffold>
  );
}
