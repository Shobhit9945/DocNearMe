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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { generateGoogleCalendarLink, generateICSFile, CalendarEvent } from "@/lib/CalendarUtils";
import { BottomNav } from "@/components/BottomNav";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAllDoctors, useClinics } from "@/lib/clinic-data";
import {
  getSpecializationLabel,
  matchSpecialization,
  resolveSpecializationId,
  SPECIALIZATION_OPTIONS,
} from "@/lib/specializations";
import { useTranslation } from "@/lib/i18n";
import { isDateWithinClosure, normalizeClinicHours } from "@/lib/scheduling";
import type {
  AppointmentCancelRequest,
  AppointmentCancelResponse,
  AppointmentCreateRequest,
  AppointmentCreateResponse,
  AppointmentListResponse,
  AppointmentRescheduleRequest,
  AppointmentRescheduleResponse,
  ClinicDoctor,
  MedicalRecordDetail,
  MedicalRecordListResponse,
  SharedMedicalRecord,
} from "@shared/api";
import { toast } from "@/components/ui/use-toast";

const TOKEN_KEY = "docnearme_patient_token";
const NAME_KEY = "docnearme_user_name";
const EMAIL_KEY = "docnearme_user_email";

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

type AuthSession = {
  token: string;
  name: string;
  email: string;
};

type UpcomingAppointment = {
  id: string;
  doctor: string;
  specialization: string;
  date: string;
  time: string;
  dateISO: string;
  clinic: string;
  type: string;
  clinicId: string;
  patientName?: string;
  patientEmail?: string;
  notes?: string;
};

const FORM_REQUIRED_CLINICS = new Set(["noguchi", "harbor-womens", "beppu-medical"]);

export default function Appointment() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const specializationParam = searchParams.get("specialization") ?? "";
  const clinicId = searchParams.get("clinic");

  const initialView =
    searchParams.get("view") === "booking" || clinicId || specializationParam
      ? "booking"
      : "upcoming";
  const [view, setView] = useState<"upcoming" | "booking">(initialView);
  const [step, setStep] = useState<"booking" | "confirmation">("booking");

  const fallbackSpecializationId = resolveSpecializationId("");
  const normalizedParam = specializationParam
    ? resolveSpecializationId(specializationParam, fallbackSpecializationId)
    : "";
  const [selectedSpecialization, setSelectedSpecialization] = useState(
    normalizedParam || fallbackSpecializationId
  );
  const [selectedClinicId, setSelectedClinicId] = useState(clinicId ?? "");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedSlot, setSelectedSlot] = useState<string | undefined>();
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [selectedVaultRecordId, setSelectedVaultRecordId] = useState("");
  const [selectedVaultRecord, setSelectedVaultRecord] = useState<MedicalRecordDetail | null>(null);
  const [vaultRecordError, setVaultRecordError] = useState<string | null>(null);
  const [isVaultRecordLoading, setIsVaultRecordLoading] = useState(false);
  const [intakeReason, setIntakeReason] = useState("");
  const [intakeConsent, setIntakeConsent] = useState(false);
  const [intakeAllergies, setIntakeAllergies] = useState("");
  const [confirmationDetails, setConfirmationDetails] = useState<ConfirmationDetails | null>(null);
  const [detailsAppointment, setDetailsAppointment] = useState<UpcomingAppointment | null>(null);
  const [actionAppointment, setActionAppointment] = useState<UpcomingAppointment | null>(null);
  const [actionType, setActionType] = useState<"reschedule" | "cancel" | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionDate, setActionDate] = useState<Date | undefined>();
  const [actionSlot, setActionSlot] = useState<string | undefined>();
  const [actionError, setActionError] = useState<string | null>(null);
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);
  const { data: clinicsData } = useClinics();
  const { data: doctorsData } = useAllDoctors();
  const clinics = clinicsData?.clinics ?? [];
  const doctors = doctorsData?.doctors ?? [];
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    phone?: string;
    clinic?: string;
    date?: string;
    slot?: string;
    intake?: string;
    intakeReason?: string;
  }>({});
  const [isBooking, setIsBooking] = useState(false);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [availabilityNotice, setAvailabilityNotice] = useState<string | null>(null);

  const generateBookingId = () =>
    `DNM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const formatDateLabel = (date: Date) =>
    new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(date);

  const buildDateTimeFromSlot = (date: Date, slot: string) => {
    const [time, period] = slot.split(" ");
    const [hoursText, minutesText] = time.split(":");
    const hours = Number(hoursText);
    const minutes = Number(minutesText);
    const normalizedHours =
      period === "PM" && hours < 12 ? hours + 12 : period === "AM" && hours === 12 ? 0 : hours;
    const result = new Date(date);
    result.setHours(normalizedHours, minutes, 0, 0);
    return result;
  };

  const clearFieldError = (field: keyof typeof fieldErrors) => {
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setAuthSession(null);
      return;
    }
    setAuthSession({
      token,
      name: localStorage.getItem(NAME_KEY) ?? "",
      email: localStorage.getItem(EMAIL_KEY) ?? "",
    });
  }, []);

  const selectedClinic = clinics.find((clinic) => clinic.id === selectedClinicId) ?? null;
  const clinicLabel = selectedClinic ? selectedClinic.name : "Select a clinic";
  const isAuthenticated = Boolean(authSession?.token);
  const selectedSpecializationId = resolveSpecializationId(
    selectedSpecialization,
    fallbackSpecializationId
  );
  const selectedSpecializationLabel = getSpecializationLabel(selectedSpecializationId);
  const clinicHours = normalizeClinicHours(selectedClinic?.hours);
  const clinicClosures = selectedClinic?.bookingClosures ?? [];

  const isDateUnavailable = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return true;
    if (!selectedClinic) return false;
    const dayName = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);
    if (clinicHours.closedDays.some((day) => day.toLowerCase() === dayName.toLowerCase())) {
      return true;
    }
    return Boolean(isDateWithinClosure(date, clinicClosures));
  };

  const specializationOptions = useMemo(() => {
    const specializationMap = new Map<string, string>();
    clinics.forEach((clinic) => {
      clinic.specializations.forEach((spec) => {
        const normalized = matchSpecialization(spec) ?? spec;
        if (!specializationMap.has(normalized)) {
          specializationMap.set(normalized, getSpecializationLabel(normalized));
        }
      });
    });

    if (specializationMap.size === 0) {
      SPECIALIZATION_OPTIONS.forEach((specialization) => {
        specializationMap.set(specialization.id, specialization.label);
      });
    }

    return Array.from(specializationMap.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [clinics]);

  const clinicsForSpecialization = useMemo(
    () =>
      clinics.filter((clinic) =>
        clinic.specializations.some((spec) => {
          const normalized = matchSpecialization(spec) ?? spec;
          return normalized.toLowerCase() === selectedSpecializationId.toLowerCase();
        })
      ),
    [clinics, selectedSpecializationId]
  );

  const doctorsForSelection = useMemo(() => {
    if (!selectedClinicId) return [];

    return doctors.filter((doctor) => {
      const normalized = matchSpecialization(doctor.specialization) ?? doctor.specialization;
      return (
        doctor.clinicId === selectedClinicId &&
        normalized.toLowerCase() === selectedSpecializationId.toLowerCase()
      );
    });
  }, [doctors, selectedClinicId, selectedSpecializationId]);

  const fallbackDoctor = useMemo<ClinicDoctor | null>(() => {
    if (!selectedClinic) return null;
    const clinicLabelParts = selectedClinic.name.split(" ");
    const clinicSeed = clinicLabelParts[clinicLabelParts.length - 1] || selectedClinic.name;
    const fallbackNames = ["Hayashi", "Kondo", "Fujita", "Ishikawa", "Tanaka"];
    const nameIndex = (selectedClinic.id.length + selectedSpecialization.length) % fallbackNames.length;
    const fallbackLastName = clinicSeed.length > 2 ? clinicSeed : fallbackNames[nameIndex];
    return {
      id: `fallback-${selectedClinic.id}-${selectedSpecialization}`,
      name: `Dr. ${fallbackLastName}`,
      clinicId: selectedClinic.id,
      specialization: selectedSpecializationLabel,
      languages: ["Japanese", "English"],
      rating: 4.6,
      nextAvailable: "Within 24 hours",
    };
  }, [selectedClinic, selectedSpecialization, selectedSpecializationLabel]);

  const doctorOptions = useMemo(() => {
    if (doctorsForSelection.length > 0) return doctorsForSelection;
    return fallbackDoctor ? [fallbackDoctor] : [];
  }, [doctorsForSelection, fallbackDoctor]);

  const selectedDoctor = doctorOptions.find((doctor) => doctor.id === selectedDoctorId) ?? null;
  const doctorDisplayName =
    selectedDoctor?.name ??
    (doctorsForSelection.length > 0
      ? "Any available doctor"
      : fallbackDoctor?.name ?? "Assigned doctor");

  // Fetch available slots based on selected date
  const { data: slotsData, isLoading: isLoadingSlots } = useQuery({
    queryKey: ["availability", selectedDate?.toISOString(), selectedClinicId],
    queryFn: async () => {
      if (!selectedDate || !selectedClinicId) return { slots: [] as string[] };
      const activeClinicId = selectedClinicId;
      const res = await fetch(
        `/api/availability?date=${selectedDate.toISOString()}&clinicId=${activeClinicId}`
      );
      if (!res.ok) throw new Error("Failed to fetch slots");
      const data = await res.json();
      return data as { slots: string[]; isClosed?: boolean; reason?: string };
    },
    enabled: view === "booking" && !!selectedDate && !!selectedClinicId,
  });

  const timeSlots = slotsData?.slots ?? [];

  const actionClinicId = actionAppointment?.clinicId ?? "";
  const { data: actionSlotsData, isLoading: isLoadingActionSlots } = useQuery({
    queryKey: ["availability", actionDate?.toISOString(), actionClinicId, "action"],
    queryFn: async () => {
      if (!actionDate || !actionClinicId) return { slots: [] as string[] };
      const res = await fetch(
        `/api/availability?date=${actionDate.toISOString()}&clinicId=${actionClinicId}`
      );
      if (!res.ok) throw new Error("Failed to fetch slots");
      const data = await res.json();
      return data as { slots: string[]; isClosed?: boolean; reason?: string };
    },
    enabled: actionType === "reschedule" && !!actionDate && !!actionClinicId,
  });

  const actionSlots = actionSlotsData?.slots ?? [];

  const { data: appointmentsData, isLoading: isLoadingAppointments, refetch: refetchAppointments } = useQuery({
    queryKey: ["appointments", "me", authSession?.token],
    enabled: isAuthenticated,
    queryFn: async () => {
      const res = await fetch("/api/appointments/me", {
        headers: {
          Authorization: `Bearer ${authSession?.token}`,
        },
      });
      if (!res.ok) {
        throw new Error("Unable to load appointments");
      }
      return (await res.json()) as AppointmentListResponse;
    },
  });

  const { data: vaultRecordsData, isLoading: isLoadingVaultRecords } = useQuery({
    queryKey: ["medical-records", authSession?.token],
    enabled: isAuthenticated,
    queryFn: async () => {
      const res = await fetch("/api/medical-records", {
        headers: {
          Authorization: `Bearer ${authSession?.token}`,
        },
      });
      if (!res.ok) {
        throw new Error("Unable to load medical records");
      }
      return (await res.json()) as MedicalRecordListResponse;
    },
  });

  const vaultRecords = vaultRecordsData?.records ?? [];

  useEffect(() => {
    if (normalizedParam) {
      setSelectedSpecialization(normalizedParam);
    }
  }, [normalizedParam]);

  useEffect(() => {
    if (!authSession) return;
    if (!patientName && authSession.name) {
      setPatientName(authSession.name);
    }
    if (!patientEmail && authSession.email) {
      setPatientEmail(authSession.email);
    }
    setAuthError(null);
  }, [authSession, patientEmail, patientName]);

  useEffect(() => {
    if (clinicId) {
      setSelectedClinicId(clinicId);
    }
  }, [clinicId]);

  useEffect(() => {
    if (!clinicsForSpecialization.some((clinic) => clinic.id === selectedClinicId)) {
      setSelectedClinicId(clinicsForSpecialization[0]?.id ?? "");
    }
  }, [clinicsForSpecialization, selectedClinicId]);

  useEffect(() => {
    if (!specializationOptions.find((spec) => spec.id === selectedSpecializationId)) {
      setSelectedSpecialization(specializationOptions[0]?.id ?? fallbackSpecializationId);
    }
  }, [fallbackSpecializationId, selectedSpecializationId, specializationOptions]);

  useEffect(() => {
    if (!FORM_REQUIRED_CLINICS.has(selectedClinicId)) {
      setIntakeReason("");
      setIntakeAllergies("");
      setIntakeConsent(false);
      setFieldErrors((prev) => ({ ...prev, intake: undefined, intakeReason: undefined }));
    }
  }, [selectedClinicId]);

  useEffect(() => {
    setSelectedDoctorId(null);
  }, [selectedClinicId, selectedSpecializationId]);

  useEffect(() => {
    if (doctorsForSelection.length === 0 && fallbackDoctor) {
      setSelectedDoctorId(fallbackDoctor.id);
    }
  }, [doctorsForSelection.length, fallbackDoctor]);

  // Reset selected slot when date changes
  useEffect(() => {
    setSelectedSlot(undefined);
  }, [selectedDate]);

  useEffect(() => {
    setSelectedSlot(undefined);
  }, [selectedClinicId]);

  useEffect(() => {
    if (!slotsData?.isClosed) {
      setAvailabilityNotice(null);
      return;
    }
    setAvailabilityNotice(slotsData.reason ?? "Clinic is closed for this date.");
  }, [slotsData?.isClosed, slotsData?.reason]);

  useEffect(() => {
    if (!selectedVaultRecordId) {
      setSelectedVaultRecord(null);
      setVaultRecordError(null);
      return;
    }
    if (!authSession?.token) {
      setVaultRecordError("Please sign in to access your vault records.");
      return;
    }
    setIsVaultRecordLoading(true);
    setVaultRecordError(null);
    void fetch(`/api/medical-records/${selectedVaultRecordId}`, {
      headers: {
        Authorization: `Bearer ${authSession.token}`,
      },
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Unable to load the selected medical record.");
        }
        return (await res.json()) as { record: MedicalRecordDetail };
      })
      .then((data) => {
        setSelectedVaultRecord(data.record);
      })
      .catch((error) => {
        setSelectedVaultRecord(null);
        setVaultRecordError(error instanceof Error ? error.message : "Unable to load medical record.");
      })
      .finally(() => {
        setIsVaultRecordLoading(false);
      });
  }, [authSession?.token, selectedVaultRecordId]);

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
      title: `Doctor Appointment - ${selectedSpecializationLabel}`,
      description: `Appointment with ${doctorDisplayName} at ${clinicLabel}. Notes: ${notes}`,
      location: clinicLabel,
      startTime,
      endTime,
    };
  }, [selectedDate, selectedSlot, selectedSpecializationLabel, clinicLabel, notes, doctorDisplayName]);

  const appointments = useMemo<UpcomingAppointment[]>(() => {
    const items = appointmentsData?.appointments ?? [];
    return items
      .filter(
        (appointment) =>
          appointment.status !== "CANCELLED_BY_PATIENT" &&
          appointment.status !== "CANCELLED_BY_CLINIC" &&
          appointment.status !== "DECLINED",
      )
      .map((appointment) => {
        const clinicName =
          appointment.clinicId === "global"
            ? "Any clinic"
            : clinics.find((clinic) => clinic.id === appointment.clinicId)?.name ?? "Clinic";
        const doctorLabel = appointment.doctorName ?? appointment.specialization;
        return {
          id: appointment._id,
          doctor: doctorLabel,
          specialization: appointment.specialization,
          date: formatDateLabel(new Date(appointment.date)),
          time: appointment.slot,
          dateISO: appointment.date,
          clinic: clinicName,
          type: "In-person",
          clinicId: appointment.clinicId,
          patientName: appointment.patientName,
          patientEmail: appointment.patientEmail,
          notes: appointment.notes,
        };
      });
  }, [appointmentsData, clinics, formatDateLabel]);

  const hasAppointments = appointments.length > 0;

  const handleStartBooking = () => {
    setView("booking");
    setStep("booking");
    setConfirmationDetails(null);
  };

  const handleConfirm = async () => {
    setAuthError(null);
    if (!isAuthenticated) {
      setAuthError("Please sign in to request an appointment.");
      return;
    }

    const errors: typeof fieldErrors = {};
    const trimmedName = patientName.trim();
    const trimmedEmail = patientEmail.trim();
    const trimmedPhone = patientPhone.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (trimmedName.length < 2) {
      errors.name = "Please enter your full name.";
    }

    if (!emailRegex.test(trimmedEmail)) {
      errors.email = "Please enter a valid email address.";
    }

    if (trimmedPhone.length < 7) {
      errors.phone = "Please enter a valid phone number.";
    }

    if (!selectedClinicId) {
      errors.clinic = "Please select a clinic.";
    }

    if (!selectedDate) {
      errors.date = "Please select an appointment date.";
    }

    if (!selectedSlot) {
      errors.slot = "Please select an appointment time.";
    }

    if (FORM_REQUIRED_CLINICS.has(selectedClinicId)) {
      if (!intakeReason) {
        errors.intakeReason = "Please select a reason for your visit.";
      }
      if (!intakeConsent) {
        errors.intake = "Please confirm the intake form acknowledgment.";
      }
    }

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    if (!selectedDate || !selectedSlot || !selectedClinicId) return;

    setIsBooking(true);
    const doctorLabel = doctorDisplayName;
    const clinicKey = selectedClinicId;
    const sharedRecordPayload: SharedMedicalRecord | undefined = selectedVaultRecord
      ? {
          recordId: selectedVaultRecord.id,
          name: selectedVaultRecord.name,
          type: selectedVaultRecord.type,
          size: selectedVaultRecord.size,
          iv: selectedVaultRecord.iv,
          data: selectedVaultRecord.data,
        }
      : undefined;
    const preferredStart = buildDateTimeFromSlot(selectedDate, selectedSlot);
    const preferredEnd = new Date(preferredStart.getTime() + 30 * 60 * 1000);
    const payload: AppointmentCreateRequest = {
      clinicId: clinicKey,
      preferredStart: preferredStart.toISOString(),
      preferredEnd: preferredEnd.toISOString(),
      patientName: trimmedName,
      patientPhone: trimmedPhone,
      patientEmail: trimmedEmail,
      note: notes,
      specialization: selectedSpecializationLabel,
      doctorName: doctorDisplayName,
      slot: selectedSlot,
      sharedRecord: sharedRecordPayload,
    };

    try {
      const response = await fetch("/api/appointments/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authSession?.token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as AppointmentCreateResponse | { error?: string };
      if (!response.ok) {
        const message = "error" in data && data.error ? data.error : "Unable to request appointment.";
        if (response.status === 401) {
          setAuthError("Your session has expired. Please sign in again.");
        } else {
          setAuthError(message);
        }
        return;
      }

      const bookingId = "id" in data && data.id ? data.id : generateBookingId();

      setConfirmationDetails({
        id: bookingId,
        clinicName: clinicLabel,
        patientName: trimmedName,
        patientEmail: trimmedEmail,
        doctorName: doctorLabel,
        specialization: selectedSpecializationLabel,
        dateLabel: formatDateLabel(selectedDate),
        timeLabel: selectedSlot,
        notes,
      });

      setStep("confirmation");
      window.scrollTo(0, 0);
      await refetchAppointments();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to request appointment.");
    } finally {
      setIsBooking(false);
    }
  };

  const handleOpenDetails = (appointment: UpcomingAppointment) => {
    setDetailsAppointment(appointment);
  };

  const handleOpenAction = (appointment: UpcomingAppointment, type: "reschedule" | "cancel") => {
    setActionAppointment(appointment);
    setActionType(type);
    setActionReason("");
    setActionDate(new Date(appointment.dateISO));
    setActionSlot(appointment.time);
    setActionError(null);
  };

  const handleCloseAction = () => {
    setActionAppointment(null);
    setActionType(null);
    setActionReason("");
    setActionDate(undefined);
    setActionSlot(undefined);
    setActionError(null);
  };

  const handleSubmitAction = async () => {
    const trimmedReason = actionReason.trim();
    if (!trimmedReason) {
      setActionError("Please provide a reason before submitting.");
      return;
    }

    if (!actionAppointment || !actionType) return;

    if (actionType === "reschedule") {
      if (!actionDate || !actionSlot) {
        setActionError("Please choose a new date and time.");
        return;
      }
    }

    setIsActionSubmitting(true);

    try {
      if (actionType === "cancel") {
        const payload: AppointmentCancelRequest = { reason: trimmedReason };
        const response = await fetch(`/api/appointments/${actionAppointment.id}/cancel`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authSession?.token}`,
          },
          body: JSON.stringify(payload),
        });

        const data = (await response.json()) as AppointmentCancelResponse | { error?: string };
        if (!response.ok) {
          throw new Error("error" in data && data.error ? data.error : "Unable to cancel appointment.");
        }

        toast({
          title: "Appointment cancelled",
          description: `Your appointment with ${actionAppointment.doctor} has been cancelled.`,
        });
      } else {
        const payload: AppointmentRescheduleRequest = {
          date: actionDate!.toISOString(),
          slot: actionSlot!,
          reason: trimmedReason,
        };
        const response = await fetch(`/api/appointments/${actionAppointment.id}/reschedule`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authSession?.token}`,
          },
          body: JSON.stringify(payload),
        });

        const data = (await response.json()) as AppointmentRescheduleResponse | { error?: string };
        if (!response.ok) {
          throw new Error("error" in data && data.error ? data.error : "Unable to reschedule appointment.");
        }

        toast({
          title: "Appointment rescheduled",
          description: `Your appointment with ${actionAppointment.doctor} has been moved to ${actionDate?.toLocaleDateString()} at ${actionSlot}.`,
        });
      }

      await refetchAppointments();
      handleCloseAction();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to update appointment.");
    } finally {
      setIsActionSubmitting(false);
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

  if (view === "booking" && step === "confirmation") {
    const details = confirmationDetails ?? {
      id: generateBookingId(),
      clinicName: clinicLabel,
      patientName: patientName || "Patient",
      patientEmail,
      doctorName: doctorDisplayName,
      specialization: selectedSpecializationLabel,
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
            <h1 className="text-2xl font-bold text-slate-900">Request received</h1>
            <p className="text-slate-600 max-w-md mx-auto">
              Your request for {details.dateLabel} at {details.timeLabel} was sent to the clinic. We’ll email you once it’s confirmed.
            </p>
          </div>

          <div className="w-full max-w-2xl grid gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm text-left space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Request details</h3>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Request ID: {details.id}
                </span>
              </div>
              <div className="grid gap-3 text-sm text-slate-700">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-500">Clinic</span>
                  <span className="font-medium text-slate-900">{t(details.clinicName)}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-500">Patient</span>
                  <span className="font-medium text-slate-900">{details.patientName}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-500">Doctor</span>
                  <span className="font-medium text-slate-900">{t(details.doctorName)}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-500">Specialization</span>
                  <span className="font-medium text-slate-900">{t(details.specialization)}</span>
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
              onClick={() => navigate("/home")}
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
          </div>
        </header>

        <main className="flex-1 px-4 pt-6 lg:px-10 lg:pt-10">
          <div className="max-w-5xl mx-auto space-y-6">
            {!isAuthenticated ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
                <CalendarClock className="mx-auto h-10 w-10 text-slate-400" />
                <h2 className="mt-4 text-lg font-semibold text-slate-800">
                  Sign in to view your appointments
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Your booking history is tied to your patient account.
                </p>
                <button
                  onClick={() => navigate("/patient-auth")}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#0089FF] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0077E6]"
                >
                  Sign in to continue
                </button>
              </div>
            ) : isLoadingAppointments ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-600">
                Loading appointments...
              </div>
            ) : hasAppointments ? (
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
                            {t(appointment.doctor)} · {t(appointment.specialization)}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                          <span className="flex items-center gap-2">
                            <CalendarClock className="h-4 w-4 text-[#0089FF]" />
                            {appointment.date} · {appointment.time}
                          </span>
                          <span className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-[#0089FF]" />
                            {t(appointment.clinic)}
                          </span>
                          <span className="flex items-center gap-2">
                            <Stethoscope className="h-4 w-4 text-[#0089FF]" />
                            {appointment.type}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => handleOpenDetails(appointment)}
                          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-[#0089FF] hover:text-[#0089FF]"
                        >
                          View details
                        </button>
                        <button
                          onClick={() => handleOpenAction(appointment, "reschedule")}
                          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-[#0089FF] hover:text-[#0089FF]"
                        >
                          Reschedule
                        </button>
                        <button
                          onClick={() => handleOpenAction(appointment, "cancel")}
                          className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 hover:border-rose-500 hover:text-rose-700"
                        >
                          Cancel
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

        <Dialog
          open={Boolean(detailsAppointment)}
          onOpenChange={(open) => {
            if (!open) setDetailsAppointment(null);
          }}
        >
          <DialogContent className="max-w-2xl">
            {detailsAppointment ? (
              <>
                <DialogHeader>
                  <DialogTitle>Appointment details</DialogTitle>
                  <DialogDescription>
                    Review the full booking information for your upcoming visit.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500">Doctor</span>
                    <span className="font-medium text-slate-900">
                      {t(detailsAppointment.doctor)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500">Specialization</span>
                    <span className="font-medium text-slate-900">
                      {t(detailsAppointment.specialization)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500">Date</span>
                    <span className="font-medium text-slate-900">
                      {detailsAppointment.date}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500">Time</span>
                    <span className="font-medium text-slate-900">
                      {detailsAppointment.time}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500">Clinic</span>
                    <span className="font-medium text-slate-900">
                      {t(detailsAppointment.clinic)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500">Location</span>
                    <span className="font-medium text-slate-900">
                      Location details coming soon.
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500">Visit type</span>
                    <span className="font-medium text-slate-900">
                      {detailsAppointment.type}
                    </span>
                  </div>
                  {detailsAppointment.patientName ? (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-500">Patient</span>
                      <span className="font-medium text-slate-900">
                        {detailsAppointment.patientName}
                      </span>
                    </div>
                  ) : null}
                  {detailsAppointment.patientEmail ? (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-500">Email</span>
                      <span className="font-medium text-slate-900">
                        {detailsAppointment.patientEmail}
                      </span>
                    </div>
                  ) : null}
                  {detailsAppointment.notes ? (
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-500">Notes</span>
                      <span className="font-medium text-slate-900">
                        {detailsAppointment.notes}
                      </span>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(actionType && actionAppointment)}
          onOpenChange={(open) => {
            if (!open) handleCloseAction();
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionType === "cancel" ? "Cancel appointment" : "Reschedule appointment"}
              </DialogTitle>
              <DialogDescription>
                {actionAppointment
                  ? `Please share a reason for your ${
                      actionType === "cancel" ? "cancellation" : "reschedule"
                    } for ${actionAppointment.doctor}.`
                  : "Please share a reason for this request."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-700" htmlFor="appointment-reason">
                Reason (required)
              </label>
              <Textarea
                id="appointment-reason"
                value={actionReason}
                onChange={(event) => {
                  setActionReason(event.target.value);
                  if (actionError) setActionError(null);
                }}
                placeholder="Let us know what changed so we can assist you."
                className="min-h-[120px]"
              />
              {actionError ? <p className="text-sm text-rose-500">{actionError}</p> : null}
            </div>
            {actionType === "reschedule" ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-2">
                    New date
                  </p>
                  <div className="flex justify-center">
                    <Calendar
                      mode="single"
                      selected={actionDate}
                      onSelect={(date) => {
                        setActionDate(date);
                        setActionSlot(undefined);
                        if (actionError) setActionError(null);
                      }}
                      className="rounded-md border shadow-sm"
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    />
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-2">
                    New time
                  </p>
                  {!actionDate ? (
                    <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-xl">
                      <CalendarClock className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                      <p className="font-medium">Select a date to view slots</p>
                    </div>
                  ) : isLoadingActionSlots ? (
                    <div className="flex items-center justify-center py-8 text-slate-500">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Loading slots...
                    </div>
                  ) : actionSlots.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                      {actionSlots.map((slot) => (
                        <button
                          key={slot}
                          onClick={() => {
                            setActionSlot(slot);
                            if (actionError) setActionError(null);
                          }}
                          className={cn(
                            "rounded-xl border px-3 py-2 text-sm font-semibold transition-all text-center",
                            actionSlot === slot
                              ? "border-[#0089FF] bg-[#0089FF] text-white shadow-md"
                              : "border-slate-200 bg-white text-slate-700 hover:border-[#0089FF] hover:bg-[#0089FF]/5"
                          )}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-xl">
                      <CalendarClock className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                      <p className="font-medium">No slots available</p>
                      <p className="text-sm">Please select another date</p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
            <DialogFooter>
              <button
                onClick={handleCloseAction}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-400"
              >
                Keep appointment
              </button>
              <button
                onClick={handleSubmitAction}
                className="rounded-full bg-[#0089FF] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0077E6] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isActionSubmitting}
              >
                {isActionSubmitting
                  ? "Updating..."
                  : actionType === "cancel"
                    ? "Cancel appointment"
                    : "Reschedule appointment"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
            <h1 className="text-2xl font-bold text-black">Request an appointment</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pt-6 lg:px-10 lg:pt-10">
        <div className="max-w-7xl mx-auto">
          {authError ? (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
              {authError}
            </div>
          ) : null}
          {!isAuthenticated ? (
            <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>Sign in to book an appointment and keep your visit history in one place.</span>
              <button
                onClick={() => navigate("/patient-auth")}
                className="inline-flex items-center justify-center rounded-full bg-[#0089FF] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0077E6]"
              >
                Sign in
              </button>
            </div>
          ) : null}
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
                  {specializationOptions.map((spec) => (
                    <option key={spec.id} value={spec.id}>
                      {t(spec.label)}
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
                  onChange={(e) => {
                    setSelectedClinicId(e.target.value);
                    if (fieldErrors.clinic) clearFieldError("clinic");
                  }}
                  className="w-full bg-white border border-gray-300 rounded-xl shadow-sm px-4 py-3 text-gray-700 focus:outline-none focus:border-[#0089FF] focus:ring-2 focus:ring-[#0089FF]/20"
                >
                  <option value="">Select a clinic</option>
                  {clinicsForSpecialization.map((clinic) => (
                    <option key={clinic.id} value={clinic.id}>
                      {t(clinic.name)}
                    </option>
                  ))}
                </select>
                {fieldErrors.clinic ? (
                  <p className="mt-2 text-sm text-red-500">{fieldErrors.clinic}</p>
                ) : null}
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
                  Selected: {t(selectedDoctor.name)}
                </span>
              ) : null}
            </div>

            {!selectedClinicId ? (
              <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Select a clinic to view doctors and languages spoken.
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {doctorsForSelection.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    We will reserve the next available doctor for this clinic based on your selection.
                  </div>
                ) : (
                  <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                    Optional: pick a specific doctor
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  {doctorOptions.map((doctor) => (
                  <button
                    key={doctor.id}
                    onClick={() => {
                      setSelectedDoctorId(doctor.id);
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
                    <p className="text-base font-semibold text-slate-900">{t(doctor.name)}</p>
                    <p className="text-sm text-slate-600">{t(doctor.specialization)}</p>
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
                          {t(language)}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                      Next availability: {doctor.nextAvailable}
                    </p>
                  </button>
                ))}
                </div>
              </div>
            )}
          </div>

          {/* Main Grid Layout - Calendar and Time Slots Side by Side */}
          <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6 mb-6">
            {/* Calendar Section */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 w-full min-w-0">
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
                  onSelect={(date) => {
                    setSelectedDate(date);
                    if (date && fieldErrors.date) clearFieldError("date");
                  }}
                  className="rounded-md border shadow-sm"
                  disabled={isDateUnavailable}
                />
              </div>
              {fieldErrors.date ? (
                <p className="mt-3 text-sm text-red-500">{fieldErrors.date}</p>
              ) : null}
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
                {availabilityNotice ? (
                  <p className="mt-2 text-sm font-semibold text-rose-500">{availabilityNotice}</p>
                ) : null}
              </div>

              {!selectedClinicId ? (
                <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-xl">
                  <CalendarClock className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                  <p className="font-medium">Select a clinic to view slots</p>
                  <p className="text-sm">Choose a clinic before picking a time</p>
                </div>
              ) : isLoadingSlots ? (
                <div className="flex items-center justify-center py-12 text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  Loading slots...
                </div>
              ) : timeSlots.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
                  {timeSlots.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => {
                        setSelectedSlot(slot);
                        if (fieldErrors.slot) clearFieldError("slot");
                      }}
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
              {fieldErrors.slot ? (
                <p className="mt-3 text-sm text-red-500">{fieldErrors.slot}</p>
              ) : null}
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
                    <div className="space-y-2 sm:col-span-2">
                      <label className="text-sm font-medium text-slate-700" htmlFor="patient-phone">
                        Phone
                      </label>
                      <Input
                        id="patient-phone"
                        type="tel"
                        value={patientPhone}
                        onChange={(e) => {
                          setPatientPhone(e.target.value);
                          if (fieldErrors.phone) clearFieldError("phone");
                        }}
                        placeholder="+81 90 1234 5678"
                        required
                        aria-invalid={!!fieldErrors.phone}
                        className={cn(
                          fieldErrors.phone ? "border-red-400 focus-visible:ring-red-200" : ""
                        )}
                      />
                      {fieldErrors.phone ? (
                        <p className="text-sm text-red-500">{fieldErrors.phone}</p>
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
                  {!isAuthenticated ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                      Sign in to pick a record from your encrypted vault.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <select
                        id="medical-record"
                        value={selectedVaultRecordId}
                        onChange={(event) => setSelectedVaultRecordId(event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-[#0089FF] focus:outline-none focus:ring-2 focus:ring-[#0089FF]/20"
                      >
                        <option value="">No record selected</option>
                        {vaultRecords.map((record) => (
                          <option key={record.id} value={record.id}>
                            {record.name}
                          </option>
                        ))}
                      </select>
                      {isLoadingVaultRecords && (
                        <p className="text-xs text-slate-500">Loading vault records...</p>
                      )}
                      {isVaultRecordLoading && (
                        <p className="text-xs text-slate-500">Preparing encrypted record...</p>
                      )}
                      {vaultRecordError && <p className="text-xs text-red-500">{vaultRecordError}</p>}
                      {selectedVaultRecord ? (
                        <p className="text-sm text-slate-600">Selected: {selectedVaultRecord.name}</p>
                      ) : null}
                      <p className="text-xs text-slate-500">
                        We'll send an encrypted copy to the clinic. DocNearMe cannot read your file.
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate("/medical-records")}
                        className="text-xs font-semibold text-[#0089FF] hover:underline"
                      >
                        Manage vault
                      </button>
                    </div>
                  )}
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
                          onChange={(e) => {
                            setIntakeReason(e.target.value);
                            if (fieldErrors.intakeReason) clearFieldError("intakeReason");
                          }}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-[#0089FF] focus:outline-none focus:ring-2 focus:ring-[#0089FF]/20"
                        >
                          <option value="">Select a reason</option>
                          <option value="new-patient">New patient evaluation</option>
                          <option value="follow-up">Follow-up appointment</option>
                          <option value="consult">Specialist consult</option>
                        </select>
                        {fieldErrors.intakeReason ? (
                          <p className="text-sm text-red-500">{fieldErrors.intakeReason}</p>
                        ) : null}
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
                    <p className="text-sm text-slate-800 font-medium">{t(selectedSpecializationLabel)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Stethoscope className="w-5 h-5 text-[#0089FF] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Doctor</p>
                    <p className="text-sm text-slate-800 font-medium">
                      {t(doctorDisplayName)}
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
                    <p className="text-sm text-slate-800 font-medium">{t(clinicLabel)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Download className="w-5 h-5 text-[#0089FF] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Medical record</p>
                    <p className="text-sm text-slate-800 font-medium">
                      {selectedVaultRecord ? selectedVaultRecord.name : "None selected"}
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
                disabled={
                  !selectedClinicId ||
                  !selectedDate ||
                  !selectedSlot ||
                  isBooking ||
                  !isAuthenticated ||
                  (selectedVaultRecordId && (!selectedVaultRecord || isVaultRecordLoading)) ||
                  (FORM_REQUIRED_CLINICS.has(selectedClinicId) && (!intakeConsent || !intakeReason))
                }
                className={`w-full text-white text-base font-bold px-6 py-4 rounded-xl shadow-lg transition-all ${!selectedClinicId || !selectedDate || !selectedSlot || isBooking || !isAuthenticated || (FORM_REQUIRED_CLINICS.has(selectedClinicId) && (!intakeConsent || !intakeReason))
                  ? "bg-slate-300 cursor-not-allowed"
                  : "bg-[#0089FF] hover:bg-[#0077E6] hover:shadow-xl hover:scale-[1.02]"
                  }`}
              >
                {isBooking ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Sending request...
                  </div>
                ) : (
                  "Send appointment request"
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
