import { ChevronLeft } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { DocDaisyBanner } from "@/components/DocDaisyBanner";
import { PageScaffold } from "@/components/PageScaffold";
import { useNavigate } from "react-router-dom";

export default function Appointment() {
  const navigate = useNavigate();

  const specializations = [
    "Select Specialization",
    "General Physician",
    "Cardiologist",
    "Dermatologist",
    "Pediatrician",
    "Orthopedic Surgeon",
  ];

  return (
    <PageScaffold contentClassName="pb-28 lg:pb-12">
      <header className="bg-white px-4 pt-10 pb-4 border-b border-gray-100 shadow-sm lg:px-10 lg:rounded-t-3xl lg:border-none lg:shadow-none flex items-center gap-3">
        <button onClick={() => navigate("/")} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-6 h-6 text-black" />
        </button>
        <div className="flex-1 text-center lg:text-left">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Plan your visit</p>
          <h1 className="text-xl font-bold text-black">Book your appointment</h1>
        </div>
        <img src="/dnm.png" alt="DocNearMe Logo" className="w-14 h-14 object-contain hidden lg:block" />
      </header>

      <main className="flex-1 px-4 pt-4 lg:px-10 lg:pt-8">
        <div className="lg:grid lg:grid-cols-[2fr_1fr] lg:gap-8">
          <section className="space-y-6">
            <div className="relative overflow-hidden rounded-[20px] border border-[#D4EBFF] bg-gradient-to-br from-[#FAFAFE] to-[#E1F6FF] p-5 shadow-[0_1px_14px_0_#DFE8EC] lg:p-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <div className="flex-1">
                  <p className="text-sm font-bold text-[#002D55]">Skip the queues</p>
                  <h2 className="text-2xl font-extrabold text-[#002D55] mt-2 mb-4">WITH DOCNEARME</h2>
                  <p className="text-sm text-slate-600 mb-4">Lock in a slot with the right specialist before you even reach the hospital.</p>
                  <button className="bg-[#002D55] text-white text-sm font-semibold px-6 py-3 rounded-[12px] shadow-[0_3px_16px_0_rgba(15,39,74,0.10)]">
                    Learn more
                  </button>
                </div>
                <img
                  src="https://api.builder.io/api/v1/image/assets/TEMP/94dd9abcae8bb5e056848f9449decbaac63a2b5f?width=312"
                  alt="Doctors illustration"
                  className="w-full max-w-[220px] object-contain"
                />
              </div>
            </div>

            <div className="rounded-[20px] bg-gradient-to-b from-[#FAFAFE] to-[#D4F5FF] px-4 py-6 text-center lg:px-10">
              <h3 className="text-base font-bold text-black">SAVE TIME BY AVOIDING LONG QUEUES</h3>
              <p className="text-sm text-black mt-2">BOOK YOUR APPOINTMENT WITH THE DOCTOR YOU NEED</p>
              <div className="mt-4 flex justify-center">
                <img
                  src="https://api.builder.io/api/v1/image/assets/TEMP/efd1a0a0a615de8dfe2ff92c5e5efa34e4764d7a?width=584"
                  alt="Hospital queue illustration"
                  className="w-full max-w-[360px] rounded-xl object-cover"
                />
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-sm font-semibold text-slate-700" htmlFor="specialization">
                Choose specialization
              </label>
              <select
                id="specialization"
                defaultValue={specializations[0]}
                className="w-full bg-white border border-gray-300 rounded-[14px] shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] px-4 py-3 text-gray-600 focus:outline-none focus:border-[#0089FF]"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 1rem center",
                  backgroundSize: "1.2em",
                }}
              >
                {specializations.map((spec, index) => (
                  <option key={index} value={spec} disabled={index === 0}>
                    {spec}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => console.log("Proceeding to next booking step...")}
              className="w-full bg-[#0089FF] text-white text-base font-bold px-6 py-3 rounded-[14px] shadow-[0_4px_10px_0_rgba(0,137,255,0.3)] hover:bg-[#0077E6] transition-colors"
            >
              Proceed
            </button>

            <div className="lg:hidden">
              <DocDaisyBanner onClick={() => navigate("/docdaisy")} />
            </div>
          </section>

          <aside className="hidden lg:flex flex-col gap-6">
            <DocDaisyBanner variant="card" onClick={() => navigate("/docdaisy")} className="bg-white" />
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Queue insights</p>
                <p className="text-base font-bold text-slate-900">Average wait time: 12 mins</p>
              </div>
              <p className="text-sm text-slate-500">
                Arrive on time with confidence. We'll send reminders and let the clinic know you're on the way.
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
