import { useState, useMemo, useEffect } from "react";
import {
  CalendarClock,
  ChevronLeft,
  MapPin,
  Stethoscope,
  CheckCircle,
  Calendar as CalendarIcon,
  Download,
  Loader2,
  Star
} from "lucide-react";
import { DocDaisyBanner } from "@/components/DocDaisyBanner";
import { PageScaffold } from "@/components/PageScaffold";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Calendar } from "@/components/ui/calendar";
import { generateGoogleCalendarLink, generateICSFile, CalendarEvent } from "@/lib/CalendarUtils";
import { BottomNav } from "@/components/BottomNav";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { CLINICS } from "@/lib/clinics";
import { matchSpecialization, SPECIALIZATION_OPTIONS } from "@/lib/specializations";

const SAMPLE_APPOINTMENTS = [
  {
    id: "sample-1",
    doctor: "Dr. Lina Carter",
    specialization: "Dermatologist",
    date: "Tuesday, Jan 21, 2026",
    time: "10:30 AM",
    clinic: "DocNearMe Downtown Clinic",
    type: "In-person",
  },
];

type DoctorProfile = {
  id: string;
  name: string;
  clinicId: string;
  specialization: string;
  languages: string[];
  rating: number;
  nextAvailable: string;
};

type ConfirmationDetails = {
  id: string;
  clinicName: string;
  patientName: string;
  patientEmail: string;
  doctorName: string;
  specialization: string;
  dateLabel: string;
  timeLabel: string;
  notes?: string;
};

const DOCTORS: DoctorProfile[] = [
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

const FORM_REQUIRED_CLINICS = new Set(["noguchi", "harbor-womens", "beppu-medical"]);

export default function Appointment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const specializationParam = searchParams.get("specialization") ?? "";
  const clinicId = searchParams.get("clinic");

  const initialView =
    searchParams.get("view") === "booking" || clinicId || specializationParam
      ? "booking"
      : "upcoming";
  const [view, setView] = useState<"upcoming" | "booking">(initialView);
  const [step, setStep] = useState<"booking" | "confirmation">("booking");

  const normalizedParam =
    (specializationParam && matchSpecialization(specializationParam)) ||
    specializationParam;
  const [selectedSpecialization, setSelectedSpecialization] = useState(
    normalizedParam || "General Physician"
  );
  const [selectedClinicId, setSelectedClinicId] = useState(clinicId ?? "any");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<string | undefined>();
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [medicalRecord, setMedicalRecord] = useState<File | null>(null);
  const [intakeReason, setIntakeReason] = useState("");
  const [intakeConsent, setIntakeConsent] = useState(false);
  const [intakeAllergies, setIntakeAllergies] = useState("");
  const [confirmationDetails, setConfirmationDetails] = useState<ConfirmationDetails | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    doctor?: string;
    intake?: string;
  }>({});
  const [isBooking, setIsBooking] = useState(false);

  const generateBookingId = () =>
    `DNM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const formatDateLabel = (date: Date) =>
    new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(date);

  const clearFieldError = (field: keyof typeof fieldErrors) => {
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const selectedClinic =
    selectedClinicId === "any"
      ? null
      : CLINICS.find((clinic) => clinic.id === selectedClinicId) ?? null;
  const clinicLabel = selectedClinic ? selectedClinic.name : "Any clinic";
  const appointments = SAMPLE_APPOINTMENTS;
  const hasAppointments = appointments.length > 0;

  const clinicsForSpecialization = useMemo(
    () =>
      CLINICS.filter((clinic) =>
        clinic.specializations.some((spec) => {
          const normalized = matchSpecialization(spec) ?? spec;
          return normalized.toLowerCase() === selectedSpecialization.toLowerCase();
        })
      ),
    [selectedSpecialization]
  );

  const doctorsForSelection = useMemo(() => {
    if (selectedClinicId === "any") return [];

    return DOCTORS.filter((doctor) => {
      const normalized = matchSpecialization(doctor.specialization) ?? doctor.specialization;
      return (
        doctor.clinicId === selectedClinicId &&
        normalized.toLowerCase() === selectedSpecialization.toLowerCase()
      );
    });
  }, [selectedClinicId, selectedSpecialization]);

  const selectedDoctor = doctorsForSelection.find((doctor) => doctor.id === selectedDoctorId) ?? null;

  // Fetch available slots based on selected date
  const { data: slotsData, isLoading: isLoadingSlots } = useQuery({
    queryKey: ["availability", selectedDate?.toISOString(), selectedClinicId],
    queryFn: async () => {
      if (!selectedDate) return [];
      const activeClinicId = selectedClinicId === "any" ? "" : selectedClinicId;
      const res = await fetch(
        `/api/availability?date=${selectedDate.toISOString()}&clinicId=${activeClinicId}`
      );
      if (!res.ok) throw new Error("Failed to fetch slots");
      const data = await res.json();
      return data.slots as string[];
    },
    enabled: view === "booking" && !!selectedDate,
  });

  const timeSlots = slotsData || [];

  useEffect(() => {
    if (normalizedParam) {
      setSelectedSpecialization(normalizedParam);
    }
  }, [normalizedParam]);

  useEffect(() => {
    if (clinicId) {
      setSelectedClinicId(clinicId);
    }
  }, [clinicId]);

  useEffect(() => {
    if (
      selectedClinicId !== "any" &&
      !clinicsForSpecialization.some((clinic) => clinic.id === selectedClinicId)
    ) {
      setSelectedClinicId("any");
    }
  }, [clinicsForSpecialization, selectedClinicId]);

  useEffect(() => {
    if (!FORM_REQUIRED_CLINICS.has(selectedClinicId)) {
      setIntakeReason("");
      setIntakeAllergies("");
      setIntakeConsent(false);
      setFieldErrors((prev) => ({ ...prev, intake: undefined }));
    }
  }, [selectedClinicId]);

  useEffect(() => {
    setSelectedDoctorId(null);
    setFieldErrors((prev) => ({ ...prev, doctor: undefined }));
  }, [selectedClinicId, selectedSpecialization]);

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
      description: `Appointment with ${selectedDoctor?.name ?? selectedSpecialization} at ${clinicLabel}. Notes: ${notes}`,
      location: clinicLabel,
      startTime,
      endTime,
    };
  }, [selectedDate, selectedSlot, selectedSpecialization, clinicLabel, notes, selectedDoctor]);

  const handleStartBooking = () => {
    setView("booking");
    setStep("booking");
    setConfirmationDetails(null);
  };

  const handleConfirm = async () => {
    const errors: typeof fieldErrors = {};
    const trimmedName = patientName.trim();
    const trimmedEmail = patientEmail.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (trimmedName.length < 2) {
      errors.name = "Please enter your full name.";
    }

    if (!emailRegex.test(trimmedEmail)) {
      errors.email = "Please enter a valid email address.";
    }

    if (selectedClinicId !== "any" && doctorsForSelection.length > 0 && !selectedDoctorId) {
      errors.doctor = "Please select a doctor for this clinic.";
    }

    if (FORM_REQUIRED_CLINICS.has(selectedClinicId) && !intakeConsent) {
      errors.intake = "Please confirm the intake form acknowledgment.";
    }

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    if (!selectedDate || !selectedSlot) return;

    setIsBooking(true);
    const doctorLabel = selectedDoctor?.name ?? selectedSpecialization;
    const bookingId = generateBookingId();

    setConfirmationDetails({
      id: bookingId,
      clinicName: clinicLabel,
      patientName: trimmedName,
      patientEmail: trimmedEmail,
      doctorName: doctorLabel,
      specialization: selectedSpecialization,
      dateLabel: formatDateLabel(selectedDate),
      timeLabel: selectedSlot,
      notes,
    });

    setStep("confirmation");
    window.scrollTo(0, 0);
    setIsBooking(false);
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

  if (view === "booking" && step === "confirmation") {
    const details = confirmationDetails ?? {
      id: generateBookingId(),
      clinicName: clinicLabel,
      patientName: patientName || "Patient",
      patientEmail,
      doctorName: selectedDoctor?.name ?? selectedSpecialization,
      specialization: selectedSpecialization,
      dateLabel: selectedDate ? formatDateLabel(selectedDate) : "Date pending",
      timeLabel: selectedSlot ?? "Time pending",
      notes,
    };

    return (
      <PageScaffold contentClassName="pb-28 lg:pb-12">
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">Appointment Confirmed!</h1>
            <p className="text-slate-600 max-w-md mx-auto">
              Your appointment with {details.doctorName} has been successfully booked for {details.dateLabel} at {details.timeLabel}.
            </p>
          </div>

          <div className="w-full max-w-2xl grid gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm text-left space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Booking details</h3>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Booking ID: {details.id}
                </span>
              </div>
              <div className="grid gap-3 text-sm text-slate-700">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-500">Clinic</span>
                  <span className="font-medium text-slate-900">{details.clinicName}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-500">Patient</span>
                  <span className="font-medium text-slate-900">{details.patientName}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-500">Doctor</span>
                  <span className="font-medium text-slate-900">{details.doctorName}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-500">Specialization</span>
                  <span className="font-medium text-slate-900">{details.specialization}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-500">Date</span>
                  <span className="font-medium text-slate-900">{details.dateLabel}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-500">Time</span>
                  <span className="font-medium text-slate-900">{details.timeLabel}</span>
                </div>
                {details.patientEmail ? (
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-slate-500">Email</span>
                    <span className="font-medium text-slate-900">{details.patientEmail}</span>
                  </div>
                ) : null}
                {details.notes ? (
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-slate-500">Notes</span>
                    <span className="font-medium text-slate-900">{details.notes}</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
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
                  Apple Calendar
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setView("upcoming");
              setStep("booking");
              setConfirmationDetails(null);
            }}
            className="text-[#0089FF] font-semibold hover:underline"
          >
            Back to appointments
          </button>
        </div>
        <div className="lg:hidden">
          <BottomNav />
        </div>
      </PageScaffold>
    );
  }

  if (view === "upcoming") {
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
                Your care plan
              </p>
              <h1 className="text-2xl font-bold text-black">Upcoming appointments</h1>
            </div>
            <button
              onClick={handleStartBooking}
              className="hidden sm:inline-flex items-center gap-2 rounded-full bg-[#0089FF] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0077E6]"
            >
              Book appointment
            </button>
            <img src="/dnm.png" alt="DocNearMe Logo" className="w-14 h-14 object-contain hidden lg:block" />
          </div>
        </header>

        <main className="flex-1 px-4 pt-6 lg:px-10 lg:pt-10">
          <div className="max-w-5xl mx-auto space-y-6">
            {hasAppointments ? (
              <div className="grid gap-4">
                {appointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                            Next appointment
                          </p>
                          <p className="text-lg font-semibold text-slate-900">
                            {appointment.doctor} · {appointment.specialization}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                          <span className="flex items-center gap-2">
                            <CalendarClock className="h-4 w-4 text-[#0089FF]" />
                            {appointment.date} · {appointment.time}
                          </span>
                          <span className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-[#0089FF]" />
                            {appointment.clinic}
                          </span>
                          <span className="flex items-center gap-2">
                            <Stethoscope className="h-4 w-4 text-[#0089FF]" />
                            {appointment.type}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <button className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-[#0089FF] hover:text-[#0089FF]">
                          View details
                        </button>
                        <button className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-[#0089FF] hover:text-[#0089FF]">
                          Reschedule
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
                <CalendarClock className="mx-auto h-10 w-10 text-slate-400" />
                <h2 className="mt-4 text-lg font-semibold text-slate-800">
                  No upcoming appointments
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Book your first visit and we will keep everything organized here.
                </p>
                <button
                  onClick={handleStartBooking}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#0089FF] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0077E6]"
                >
                  Book an appointment
                </button>
              </div>
            )}

            <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Need another visit?</h3>
                <p className="text-sm text-slate-600">
                  Book a new appointment whenever you are ready.
                </p>
              </div>
              <button
                onClick={handleStartBooking}
                className="inline-flex items-center gap-2 rounded-full bg-[#0089FF] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0077E6]"
              >
                Book appointment
              </button>
            </div>
          </div>
        </main>

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
            onClick={() => setView("upcoming")}
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
          <div className="mb-6 grid gap-4 rounded-2xl border border-slate-200 bg-white shadow-sm p-6 lg:grid-cols-[1fr_1fr]">
            <div className="flex items-center gap-4">
              <Stethoscope className="w-6 h-6 text-[#0089FF] flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-2">
                  Select Specialist
                </p>
                <select
                  value={selectedSpecialization}
                  onChange={(e) => setSelectedSpecialization(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl shadow-sm px-4 py-3 text-gray-700 focus:outline-none focus:border-[#0089FF] focus:ring-2 focus:ring-[#0089FF]/20"
                >
                  {SPECIALIZATION_OPTIONS.map((spec) => (
                    <option key={spec.id} value={spec.id}>
                      {spec.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <MapPin className="w-6 h-6 text-[#0089FF] flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-2">
                  Select Clinic
                </p>
                <select
                  value={selectedClinicId}
                  onChange={(e) => setSelectedClinicId(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl shadow-sm px-4 py-3 text-gray-700 focus:outline-none focus:border-[#0089FF] focus:ring-2 focus:ring-[#0089FF]/20"
                >
                  <option value="any">Any clinic</option>
                  {clinicsForSpecialization.map((clinic) => (
                    <option key={clinic.id} value={clinic.id}>
                      {clinic.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                  Select Doctor
                </p>
                <p className="text-sm text-slate-600">
                  Choose a provider from the selected clinic and specialization.
                </p>
              </div>
              {selectedDoctor ? (
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                  Selected: {selectedDoctor.name}
                </span>
              ) : null}
            </div>

            {selectedClinicId === "any" ? (
              <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Select a clinic to view doctors and languages spoken.
              </div>
            ) : doctorsForSelection.length === 0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                No doctors available for this specialization at the selected clinic.
              </div>
            ) : (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {doctorsForSelection.map((doctor) => (
                  <button
                    key={doctor.id}
                    onClick={() => {
                      setSelectedDoctorId(doctor.id);
                      clearFieldError("doctor");
                    }}
                    className={cn(
                      "w-full text-left rounded-2xl border p-4 transition-all",
                      selectedDoctorId === doctor.id
                        ? "border-[#0089FF] bg-[#0089FF]/5 shadow-md"
                        : "border-slate-200 bg-white hover:border-[#0089FF]/60 hover:shadow-sm"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-slate-900">{doctor.name}</p>
                        <p className="text-sm text-slate-600">{doctor.specialization}</p>
                      </div>
                      <div className="flex items-center gap-1 text-sm font-semibold text-slate-700">
                        <Star className="h-4 w-4 text-amber-400" />
                        {doctor.rating.toFixed(1)}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {doctor.languages.map((language) => (
                        <span
                          key={language}
                          className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                        >
                          {language}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                      Next availability: {doctor.nextAvailable}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {fieldErrors.doctor ? (
              <p className="mt-3 text-sm text-red-500">{fieldErrors.doctor}</p>
            ) : null}
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

          {/* Bottom Section - Details, Notes, and Confirmation */}
          <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
            {/* Details + Notes Section */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold block mb-3">
                    Your details
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700" htmlFor="patient-name">
                        Full name
                      </label>
                      <Input
                        id="patient-name"
                        value={patientName}
                        onChange={(e) => {
                          setPatientName(e.target.value);
                          if (fieldErrors.name) clearFieldError("name");
                        }}
                        placeholder="Alex Patient"
                        required
                        aria-invalid={!!fieldErrors.name}
                        className={cn(
                          fieldErrors.name ? "border-red-400 focus-visible:ring-red-200" : ""
                        )}
                      />
                      {fieldErrors.name ? (
                        <p className="text-sm text-red-500">{fieldErrors.name}</p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700" htmlFor="patient-email">
                        Email
                      </label>
                      <Input
                        id="patient-email"
                        type="email"
                        value={patientEmail}
                        onChange={(e) => {
                          setPatientEmail(e.target.value);
                          if (fieldErrors.email) clearFieldError("email");
                        }}
                        placeholder="you@example.com"
                        required
                        aria-invalid={!!fieldErrors.email}
                        className={cn(
                          fieldErrors.email ? "border-red-400 focus-visible:ring-red-200" : ""
                        )}
                      />
                      {fieldErrors.email ? (
                        <p className="text-sm text-red-500">{fieldErrors.email}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div>
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
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide text-slate-500 font-semibold block" htmlFor="medical-record">
                    Previous medical records (optional)
                  </label>
                  <Input
                    id="medical-record"
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) => setMedicalRecord(e.target.files?.[0] ?? null)}
                    className="h-auto py-2"
                  />
                  {medicalRecord ? (
                    <p className="text-sm text-slate-600">Selected: {medicalRecord.name}</p>
                  ) : null}
                </div>

                {FORM_REQUIRED_CLINICS.has(selectedClinicId) ? (
                  <div className="rounded-2xl border border-dashed border-[#0089FF]/40 bg-[#0089FF]/5 p-4 space-y-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-[#0089FF] font-semibold">
                        Quick intake form (prototype)
                      </p>
                      <p className="text-sm text-slate-600">
                        This clinic requires a short intake form before confirming.
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700" htmlFor="intake-reason">
                          Reason for visit
                        </label>
                        <select
                          id="intake-reason"
                          value={intakeReason}
                          onChange={(e) => setIntakeReason(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-[#0089FF] focus:outline-none focus:ring-2 focus:ring-[#0089FF]/20"
                        >
                          <option value="">Select a reason</option>
                          <option value="new-patient">New patient evaluation</option>
                          <option value="follow-up">Follow-up appointment</option>
                          <option value="consult">Specialist consult</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700" htmlFor="intake-allergies">
                          Allergies (optional)
                        </label>
                        <Input
                          id="intake-allergies"
                          value={intakeAllergies}
                          onChange={(e) => setIntakeAllergies(e.target.value)}
                          placeholder="Penicillin, pollen, etc."
                        />
                      </div>
                    </div>
                    <label className="flex items-start gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={intakeConsent}
                        onChange={(e) => {
                          setIntakeConsent(e.target.checked);
                          if (fieldErrors.intake) clearFieldError("intake");
                        }}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-[#0089FF] focus:ring-[#0089FF]"
                      />
                      I confirm the information is correct for this clinic intake form.
                    </label>
                    {fieldErrors.intake ? (
                      <p className="text-sm text-red-500">{fieldErrors.intake}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
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
                  <Stethoscope className="w-5 h-5 text-[#0089FF] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Doctor</p>
                    <p className="text-sm text-slate-800 font-medium">
                      {selectedDoctor?.name ?? "Select a doctor"}
                    </p>
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

                <div className="flex items-start gap-3">
                  <Download className="w-5 h-5 text-[#0089FF] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Medical record</p>
                    <p className="text-sm text-slate-800 font-medium">
                      {medicalRecord ? medicalRecord.name : "None uploaded"}
                    </p>
                  </div>
                </div>

                {FORM_REQUIRED_CLINICS.has(selectedClinicId) ? (
                  <div className="rounded-xl border border-dashed border-[#0089FF]/40 bg-[#0089FF]/5 p-3 text-xs text-slate-600">
                    Intake form required · {intakeConsent ? "Acknowledged" : "Pending confirmation"}
                  </div>
                ) : null}
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
