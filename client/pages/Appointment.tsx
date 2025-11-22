import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  ChevronLeft,
  MapPin,
  Phone,
  Stethoscope,
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { DocDaisyBanner } from "@/components/DocDaisyBanner";
import { PageScaffold } from "@/components/PageScaffold";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "@/lib/i18n";

const SPECIALIZATIONS = [
  "General Physician",
  "Cardiologist",
  "Dermatologist",
  "Pediatrician",
  "Orthopedic Surgeon",
  "Gastroenterology",
  "Neurology",
  "Psychiatry",
  "Ophthalmology",
  "Endocrinology",
  "Oncology",
  "Pulmonology",
  "Rheumatology",
  "ENT",
  "Gynecology",
  "Urology",
  "Nephrology",
];

const TIME_SLOTS = [
  "Today, 4:30 PM",
  "Today, 6:10 PM",
  "Tomorrow, 9:00 AM",
  "Tomorrow, 11:30 AM",
  "Tomorrow, 3:30 PM",
];

export default function Appointment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();

  const specializationParam = searchParams.get("specialization") ?? "";
  const clinicId = searchParams.get("clinic");

  const specializationOptions = useMemo(() => {
    const unique = new Set(SPECIALIZATIONS);
    if (specializationParam) {
      unique.add(specializationParam);
    }
    return Array.from(unique);
  }, [specializationParam]);

  const defaultSpecialization =
    specializationParam && specializationOptions.includes(specializationParam)
      ? specializationParam
      : "General Physician";

  const [selectedSpecialization, setSelectedSpecialization] = useState(
    defaultSpecialization
  );
  const [visitType, setVisitType] = useState<"In-person" | "Online">("In-person");
  const [selectedSlot, setSelectedSlot] = useState(TIME_SLOTS[0]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (specializationParam) {
      setSelectedSpecialization(specializationParam);
    }
  }, [specializationParam]);

  const quickPicks = specializationOptions.slice(0, 6);
  const clinicLabel = clinicId ? clinicId.replace(/-/g, " ") : "Any clinic";

  return (
    <PageScaffold contentClassName="pb-28 lg:pb-12">
      <header className="bg-white px-4 pt-10 pb-4 border-b border-gray-100 shadow-sm lg:px-10 lg:rounded-t-3xl lg:border-none lg:shadow-none flex items-center gap-3">
        <button
          onClick={() => navigate("/")}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-black" />
        </button>
        <div className="flex-1 text-center lg:text-left">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
            {t("Plan your visit")}
          </p>
          <h1 className="text-xl font-bold text-black">{t("Book your appointment")}</h1>
        </div>
        <img src="/dnm.png" alt="DocNearMe Logo" className="w-14 h-14 object-contain hidden lg:block" />
      </header>

      <main className="flex-1 px-4 pt-4 lg:px-10 lg:pt-8">
        <div className="lg:grid lg:grid-cols-[2fr_1fr] lg:gap-8">
          <section className="space-y-6">
            <div className="relative overflow-hidden rounded-[20px] border border-[#D4EBFF] bg-gradient-to-br from-[#FAFAFE] to-[#E1F6FF] p-5 shadow-[0_1px_14px_0_#DFE8EC] lg:p-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <div className="flex-1 space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-[#002D55] shadow-sm">
                    <Stethoscope className="w-4 h-4" /> {selectedSpecialization}
                  </div>
                  <h2 className="text-2xl font-extrabold text-[#002D55]">
                    {t("Lock in the right specialist without the wait")}
                  </h2>
                  <p className="text-sm text-slate-600">
                    {t("Secure a slot before you arrive. DocDaisy will share your summary with the clinic so they’re ready for you.")}
                  </p>
                  <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 shadow-sm">
                      <CalendarClock className="w-4 h-4 text-[#0089FF]" /> {t("Real-time availability")}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 shadow-sm">
                      <MapPin className="w-4 h-4 text-[#0089FF]" /> {clinicLabel}
                    </span>
                  </div>
                </div>
                <img
                  src="https://api.builder.io/api/v1/image/assets/TEMP/94dd9abcae8bb5e056848f9449decbaac63a2b5f?width=312"
                  alt="Doctors illustration"
                  className="w-full max-w-[220px] object-contain"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 lg:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{t("Specialist selection")}</p>
                    <p className="text-sm text-slate-600">{t("Choose who you want to see before picking a slot.")}</p>
                  </div>
                  {specializationParam && (
                    <span className="rounded-full bg-[#E5DEFF] px-3 py-1 text-xs font-semibold text-[#3A12DB]">
                      {t("Suggested by DocDaisy")}
                    </span>
                  )}
                </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="specialization">
                    {t("Specialization")}
                  </label>
                  <select
                    id="specialization"
                    value={selectedSpecialization}
                    onChange={(e) => setSelectedSpecialization(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-[14px] shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] px-4 py-3 text-gray-700 focus:outline-none focus:border-[#0089FF]"
                  >
                    {specializationOptions.map((spec) => (
                      <option key={spec} value={spec}>
                        {spec}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{t("Quick picks")}</p>
                  <div className="flex flex-wrap gap-2">
                    {quickPicks.map((spec) => (
                      <button
                        key={spec}
                        onClick={() => setSelectedSpecialization(spec)}
                        className={`rounded-full border px-3 py-2 text-sm font-semibold transition-all ${
                          selectedSpecialization === spec
                            ? "border-[#1648CE] bg-[#E5DEFF] text-[#1648CE] shadow-sm"
                            : "border-slate-200 bg-slate-50 text-slate-600 hover:border-[#D4EBFF]"
                        }`}
                      >
                        {spec}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 lg:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{t("Appointment details")}</p>
                    <p className="text-sm text-slate-600">{t("Confirm how and when you want to meet the doctor.")}</p>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{t("Visit type")}</p>
                    <div className="flex flex-wrap gap-2">
                    {["In-person", "Online"].map((type) => (
                      <button
                        key={type}
                        onClick={() => setVisitType(type as typeof visitType)}
                        className={`flex-1 min-w-[140px] rounded-2xl border px-4 py-3 text-sm font-semibold transition-all ${
                          visitType === type
                            ? "border-[#0089FF] bg-[#E1F4FF] text-[#002D55] shadow-sm"
                            : "border-slate-200 bg-slate-50 text-slate-600 hover:border-[#D4EBFF]"
                          }`}
                      >
                        {t(type)}
                      </button>
                    ))}
                  </div>
                </div>

                  <div className="space-y-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{t("Available slots")}</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
                      {TIME_SLOTS.map((slot) => (
                      <button
                        key={slot}
                        onClick={() => setSelectedSlot(slot)}
                        className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-all text-left ${
                          selectedSlot === slot
                            ? "border-[#1648CE] bg-[#E5DEFF] text-[#1648CE] shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:border-[#D4EBFF]"
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-slate-500 font-semibold" htmlFor="notes">
                  {t("Share additional notes (optional)")}
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder={t("Symptoms, allergies, accessibility needs...")}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-[#0089FF] focus:outline-none"
                />
              </div>

              <button
                onClick={() => console.log("Proceeding to next booking step...")}
                className="w-full bg-[#0089FF] text-white text-base font-bold px-6 py-3 rounded-[14px] shadow-[0_4px_10px_0_rgba(0,137,255,0.3)] hover:bg-[#0077E6] transition-colors"
              >
                {t("Confirm appointment")}
              </button>
            </div>

            <div className="lg:hidden">
              <DocDaisyBanner onClick={() => navigate("/docdaisy")} />
            </div>
          </section>

          <aside className="hidden lg:flex flex-col gap-6">
            <DocDaisyBanner variant="card" onClick={() => navigate("/docdaisy")} className="bg-white" />

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <CalendarClock className="w-5 h-5 text-[#0089FF]" />
                <div>
                  <p className="text-sm font-semibold text-slate-800">Selected slot</p>
                  <p className="text-sm text-slate-600">{selectedSlot}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Stethoscope className="w-5 h-5 text-[#0089FF]" />
                <div>
                  <p className="text-sm font-semibold text-slate-800">Specialization</p>
                  <p className="text-sm text-slate-600">{selectedSpecialization}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-[#0089FF]" />
                <div>
                  <p className="text-sm font-semibold text-slate-800">Visit type</p>
                  <p className="text-sm text-slate-600">{visitType}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-[#0089FF]" />
                <div>
                  <p className="text-sm font-semibold text-slate-800">Clinic</p>
                  <p className="text-sm text-slate-600">{clinicLabel}</p>
                </div>
              </div>
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
