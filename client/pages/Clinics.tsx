import { useMemo } from "react";
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
  Compass,
  Stethoscope,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

const SPECIALIZATIONS = [
  { id: "Cardiologist", label: "Cardiologist" },
  { id: "ENT", label: "ENT" },
  { id: "Dermatologist", label: "Dermatologist" },
  { id: "General Physician", label: "General Physician" },
  { id: "Pediatrician", label: "Pediatrician" },
  { id: "Orthopedic Surgeon", label: "Orthopedic" },
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
    specializations: ["Cardiologist", "ENT", "General Physician"],
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
    specializations: ["Cardiologist", "Dermatologist", "Orthopedic Surgeon"],
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
    specializations: ["ENT"],
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
    specializations: ["Dermatologist"],
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
    specializations: ["General Physician", "Pediatrician"],
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
    specializations: ["Orthopedic Surgeon", "General Physician"],
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
    specializations: ["Pediatrician"],
    nextAvailability: "Today, 3:00 PM",
  },
];

export default function Clinics() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const specializationParam = searchParams.get("specialization") ?? SPECIALIZATIONS[0].id;
  const selectedSpecialization = SPECIALIZATIONS.some((spec) => spec.id === specializationParam)
    ? specializationParam
    : SPECIALIZATIONS[0].id;

  const clinics = useMemo(
    () => CLINICS.filter((clinic) => clinic.specializations.includes(selectedSpecialization)),
    [selectedSpecialization]
  );

  const selectedLabel = SPECIALIZATIONS.find((spec) => spec.id === selectedSpecialization)?.label ?? selectedSpecialization;

  const handleSpecializationChange = (specialization: string) => {
    setSearchParams({ specialization });
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
                <div>
                  <p className="text-sm font-semibold text-[#002D55]">{selectedLabel} specialists near you</p>
                  <h2 className="text-2xl font-bold text-[#002D55] mt-1">{clinics.length} hospitals available in Beppu</h2>
                  <p className="text-sm text-slate-600 mt-2">Based on your DocDaisy assessment and live location.</p>
                  <div className="mt-4 flex flex-wrap gap-3 text-sm">
                    <button className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-slate-700 shadow-sm">
                      <Filter className="w-4 h-4" /> Filter
                    </button>
                    <button className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-slate-700 shadow-sm">
                      <Compass className="w-4 h-4" /> Sort by distance
                    </button>
                    <button className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-slate-700 shadow-sm">
                      <Stethoscope className="w-4 h-4" /> Specialisation
                    </button>
                  </div>
                </div>
                <div className="rounded-2xl bg-white/80 p-4 text-sm text-slate-600 shadow-sm">
                  <p className="font-semibold text-[#002D55]">Live location</p>
                  <p>AP House 5, Ritsumeikan APU</p>
                  <p className="text-xs text-slate-500 mt-2">Updated a moment ago</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {SPECIALIZATIONS.map((spec) => (
                <button
                  key={spec.id}
                  onClick={() => handleSpecializationChange(spec.id)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                    spec.id === selectedSpecialization
                      ? "border-[#3A12DB] bg-[#E5DEFF] text-[#3A12DB] shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-[#D4EBFF]"
                  }`}
                >
                  {spec.label}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {clinics.map((clinic) => (
                <article
                  key={clinic.id}
                  className="rounded-[28px] border border-slate-100 bg-white shadow-[0_10px_35px_rgba(21,47,81,0.05)] overflow-hidden"
                >
                  <div className="h-48 w-full overflow-hidden">
                    <img src={clinic.image} alt={clinic.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="p-5 space-y-4">
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
                      {clinic.specializations.map((spec) => (
                        <span key={spec} className="rounded-full bg-[#F1EDFF] px-3 py-1">
                          {spec}
                        </span>
                      ))}
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <CalendarClock className="w-4 h-4 text-[#0089FF]" /> Next availability: {clinic.nextAvailability}
                      </div>
                      <button
                        onClick={() => navigate(`/appointment?clinic=${clinic.id}`)}
                        className="inline-flex items-center justify-center rounded-2xl bg-[#1648CE] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#1648CE]/30 transition-colors hover:bg-[#0F3499]"
                      >
                        Book appointment
                      </button>
                    </div>
                  </div>
                </article>
              ))}

              {clinics.length === 0 && (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-8 text-center text-sm text-slate-500">
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
