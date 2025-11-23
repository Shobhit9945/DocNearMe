import { useState, useMemo, useEffect } from "react";
import {
  CalendarClock,
  ChevronLeft,
  MapPin,
  Stethoscope,
  CheckCircle,
  Calendar as CalendarIcon,
  Download,
  Loader2
} from "lucide-react";
import { DocDaisyBanner } from "@/components/DocDaisyBanner";
import { PageScaffold } from "@/components/PageScaffold";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Calendar } from "@/components/ui/calendar";
import { generateGoogleCalendarLink, generateICSFile, CalendarEvent } from "@/lib/CalendarUtils";
import { BottomNav } from "@/components/BottomNav";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

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

export default function Appointment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const specializationParam = searchParams.get("specialization") ?? "";
  const clinicId = searchParams.get("clinic");

  const [step, setStep] = useState<"booking" | "confirmation">("booking");

  const [selectedSpecialization, setSelectedSpecialization] = useState(
    specializationParam || "General Physician"
  );
  const [visitType, setVisitType] = useState<"In-person" | "Online">("In-person");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<string | undefined>();
  const [notes, setNotes] = useState("");
  const [isBooking, setIsBooking] = useState(false);

  const clinicLabel = clinicId ? clinicId.replace(/-/g, " ") : "Any clinic";

  // Fetch available slots based on selected date
  const { data: slotsData, isLoading: isLoadingSlots } = useQuery({
    queryKey: ["availability", selectedDate?.toISOString(), clinicId],
    queryFn: async () => {
      if (!selectedDate) return [];
      const res = await fetch(`/api/availability?date=${selectedDate.toISOString()}&clinicId=${clinicId || ""}`);
      if (!res.ok) throw new Error("Failed to fetch slots");
      const data = await res.json();
      return data.slots as string[];
    },
    enabled: !!selectedDate,
  });

  const timeSlots = slotsData || [];

  useEffect(() => {
    if (specializationParam) {
      setSelectedSpecialization(specializationParam);
    }
  }, [specializationParam]);

  // Reset selected slot when date changes
  useEffect(() => {
    setSelectedSlot(undefined);
  }, [selectedDate]);

  const calendarEvent: CalendarEvent | null = useMemo(() => {
    if (!selectedDate || !selectedSlot) return null;

    const [time, period] = selectedSlot.split(" ");
    const [hours, minutes] = time.split(":").map(Number);

    let hour = hours;
    if (period === "PM" && hour !== 12) hour += 12;
    if (period === "AM" && hour === 12) hour = 0;

    const startTime = new Date(selectedDate);
    startTime.setHours(hour, minutes, 0, 0);

    const endTime = new Date(startTime);
    endTime.setHours(hour + 1, minutes, 0, 0); // 1 hour duration

    return {
      title: `Doctor Appointment - ${selectedSpecialization}`,
      description: `Appointment with ${selectedSpecialization} at ${clinicLabel}. Notes: ${notes}`,
      location: clinicLabel,
      startTime,
      endTime,
    };
  }, [selectedDate, selectedSlot, selectedSpecialization, clinicLabel, notes]);

  const handleConfirm = async () => {
    if (!selectedDate || !selectedSlot) return;

    setIsBooking(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate.toISOString(),
          slot: selectedSlot,
          specialization: selectedSpecialization,
          clinicId: clinicId || "default",
          notes
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.error || "Failed to book appointment");
        return;
      }

      setStep("confirmation");
      window.scrollTo(0, 0);
    } catch (error) {
      console.error("Booking failed", error);
      alert("Something went wrong. Please try again.");
    } finally {
      setIsBooking(false);
    }
  };

  const handleAddToGoogleCalendar = () => {
    if (calendarEvent) {
      window.open(generateGoogleCalendarLink(calendarEvent), "_blank");
    }
  };

  const handleDownloadICS = () => {
    if (calendarEvent) {
      const link = document.createElement("a");
      link.href = generateICSFile(calendarEvent);
      link.download = "appointment.ics";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (step === "confirmation") {
    return (
      <PageScaffold contentClassName="pb-28 lg:pb-12">
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">Appointment Confirmed!</h1>
            <p className="text-slate-600 max-w-md mx-auto">
              Your appointment with the {selectedSpecialization} has been successfully booked for {selectedDate?.toLocaleDateString()} at {selectedSlot}.
            </p>
          </div>

          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-900">Add to Calendar</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                onClick={handleAddToGoogleCalendar}
                className="flex items-center justify-center gap-2 w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-3 px-4 rounded-xl transition-colors"
              >
                <CalendarIcon className="w-5 h-5 text-blue-500" />
                Google Calendar
              </button>
              <button
                onClick={handleDownloadICS}
                className="flex items-center justify-center gap-2 w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-3 px-4 rounded-xl transition-colors"
              >
                <Download className="w-5 h-5 text-slate-500" />
                Apple / Outlook
              </button>
            </div>
          </div>

          <button
            onClick={() => navigate("/")}
            className="text-[#0089FF] font-semibold hover:underline"
          >
            Return to Home
          </button>
        </div>
        <div className="lg:hidden">
          <BottomNav />
        </div>
      </PageScaffold>
    );
  }

  return (
    <PageScaffold contentClassName="pb-28 lg:pb-12">
      <header className="bg-white px-4 pt-10 pb-6 border-b border-gray-100 shadow-sm lg:px-10 lg:rounded-t-3xl lg:border-none lg:shadow-none">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-black" />
          </button>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
              Plan your visit
            </p>
            <h1 className="text-2xl font-bold text-black">Book your appointment</h1>
          </div>
          <img src="/dnm.png" alt="DocNearMe Logo" className="w-14 h-14 object-contain hidden lg:block" />
        </div>
      </header>

      <main className="flex-1 px-4 pt-6 lg:px-10 lg:pt-10">
        <div className="max-w-7xl mx-auto">
          {/* Specialization Selection - Full Width */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
            <div className="flex items-center gap-4">
              <Stethoscope className="w-6 h-6 text-[#0089FF] flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-2">
                  Select Specialist
                </p>
                <select
                  value={selectedSpecialization}
                  onChange={(e) => setSelectedSpecialization(e.target.value)}
                  className="w-full max-w-md bg-white border border-gray-300 rounded-xl shadow-sm px-4 py-3 text-gray-700 focus:outline-none focus:border-[#0089FF] focus:ring-2 focus:ring-[#0089FF]/20"
                >
                  {SPECIALIZATIONS.map((spec) => (
                    <option key={spec} value={spec}>
                      {spec}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Main Grid Layout - Calendar and Time Slots Side by Side */}
          <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6 mb-6">
            {/* Calendar Section */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 min-w-[400px]">
              <div className="flex items-center gap-3 mb-6">
                <CalendarClock className="w-6 h-6 text-[#0089FF]" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                    Select Date
                  </p>
                  <p className="text-sm text-slate-600">Choose your preferred appointment date</p>
                </div>
              </div>
              <div className="flex justify-center w-full">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="rounded-md border shadow-sm"
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                />
              </div>
            </div>

            {/* Time Slots Section */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
              <div className="mb-6">
                <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-1">
                  Available Time Slots
                </p>
                <p className="text-sm text-slate-600">
                  {selectedDate ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Select a date'}
                </p>
              </div>

              {isLoadingSlots ? (
                <div className="flex items-center justify-center py-12 text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  Loading slots...
                </div>
              ) : timeSlots.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
                  {timeSlots.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => setSelectedSlot(slot)}
                      className={cn(
                        "rounded-xl border px-4 py-3 text-sm font-semibold transition-all text-center",
                        selectedSlot === slot
                          ? "border-[#0089FF] bg-[#0089FF] text-white shadow-md"
                          : "border-slate-200 bg-white text-slate-700 hover:border-[#0089FF] hover:bg-[#0089FF]/5"
                      )}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-xl">
                  <CalendarClock className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                  <p className="font-medium">No slots available</p>
                  <p className="text-sm">Please select another date</p>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Section - Notes and Confirmation */}
          <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
            {/* Notes Section */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
              <label className="text-xs uppercase tracking-wide text-slate-500 font-semibold block mb-3" htmlFor="notes">
                Additional Notes (Optional)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Symptoms, allergies, accessibility needs, or any other information..."
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-[#0089FF] focus:outline-none focus:ring-2 focus:ring-[#0089FF]/20"
              />
            </div>

            {/* Summary and Confirm Button */}
            <div className="space-y-4">
              {/* Booking Summary */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-900 text-lg">Booking Summary</h3>

                <div className="flex items-start gap-3">
                  <Stethoscope className="w-5 h-5 text-[#0089FF] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Specialization</p>
                    <p className="text-sm text-slate-800 font-medium">{selectedSpecialization}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CalendarClock className="w-5 h-5 text-[#0089FF] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Date & Time</p>
                    <p className="text-sm text-slate-800 font-medium">
                      {selectedDate ? selectedDate.toLocaleDateString() : "Not selected"}
                      {selectedSlot ? `, ${selectedSlot}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-[#0089FF] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Clinic</p>
                    <p className="text-sm text-slate-800 font-medium">{clinicLabel}</p>
                  </div>
                </div>
              </div>

              {/* Confirm Button */}
              <button
                onClick={handleConfirm}
                disabled={!selectedDate || !selectedSlot || isBooking}
                className={`w-full text-white text-base font-bold px-6 py-4 rounded-xl shadow-lg transition-all ${!selectedDate || !selectedSlot || isBooking
                  ? "bg-slate-300 cursor-not-allowed"
                  : "bg-[#0089FF] hover:bg-[#0077E6] hover:shadow-xl hover:scale-[1.02]"
                  }`}
              >
                {isBooking ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Confirming...
                  </div>
                ) : (
                  "Confirm Appointment"
                )}
              </button>

              {/* DocDaisy Banner - Desktop Only */}
              <div className="hidden lg:block">
                <DocDaisyBanner variant="card" onClick={() => navigate("/docdaisy")} className="bg-white" />
              </div>
            </div>
          </div>

          {/* DocDaisy Banner - Mobile Only */}
          <div className="lg:hidden mt-6">
            <DocDaisyBanner onClick={() => navigate("/docdaisy")} />
          </div>
        </div>
      </main>

      <div className="lg:hidden">
        <BottomNav />
      </div>
    </PageScaffold>
  );
}
