import { useEffect, useMemo, useState } from "react";
import type { AdminCreateClinicRequest, AdminCreateClinicResponse, ClinicDoctor, ClinicProfile } from "@shared/api";
import { useAddressSearch } from "@/hooks/useAddressSearch";
import { supportedLanguages } from "@/lib/translations";
import { AdminAuditLogsPanel } from "@/components/admin/AdminAuditLogsPanel";
import { AdminClinicList } from "@/components/admin/AdminClinicList";
import { AdminLabelsPanel } from "@/components/admin/AdminLabelsPanel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DoctorDraft = ClinicDoctor;
type ClosureDraft = {
  startDate: string;
  endDate: string;
  reason: string;
};
type PhotoDraft = { label: string; url: string };

const defaultHours = {
  weekdays: { start: "09:00", end: "18:00" },
  weekend: { start: "10:00", end: "14:00" },
  closedDays: "Wednesday",
  slotMinutes: 30,
};

const buildAuthHeader = (username: string, password: string) =>
  `Basic ${window.btoa(`${username}:${password}`)}`;

const normalizeList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const weekdayOptions = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

const makeDoctorDraft = (clinicId: string): DoctorDraft => ({
  id:
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? `doc-${crypto.randomUUID()}`
      : `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  clinicId,
  name: "",
  specialization: "",
  languages: [],
  rating: 4.5,
  nextAvailable: "",
  availability: [],
});

export default function AdminClinicOnboarding() {
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [formCredentials, setFormCredentials] = useState({ username: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState<AdminCreateClinicResponse | null>(null);
  const [activeTab, setActiveTab] = useState<"clinics" | "onboard" | "logs" | "labels">("clinics");

  const [clinic, setClinic] = useState<ClinicProfile>({
    id: "",
    name: "",
    type: "Clinic",
    rating: 4.5,
    patients: "",
    distance: "",
    location: "",
    image: "",
    specializations: [],
    nextAvailability: "",
    immediateWoundCare: false,
    bookingEnabled: true,
    googlePlaceId: "",
    phone: "",
    email: "",
    notificationEmailEnabled: true,
    notificationPhoneEnabled: false,
    notificationLineEnabled: false,
    hours: {
      weekdays: { start: defaultHours.weekdays.start, end: defaultHours.weekdays.end },
      weekend: { start: defaultHours.weekend.start, end: defaultHours.weekend.end },
      closedDays: [defaultHours.closedDays],
      slotMinutes: defaultHours.slotMinutes,
    },
    bookingClosures: [],
    pricing: { firstVisit: "", followUp: "", otherServices: "" },
    photos: [],
  });

  const [closedDaysText, setClosedDaysText] = useState(defaultHours.closedDays);
  const [pricing, setPricing] = useState({
    firstVisit: "",
    followUp: "",
    otherServices: "",
  });
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [closures, setClosures] = useState<ClosureDraft[]>([]);
  const [doctors, setDoctors] = useState<DoctorDraft[]>([]);
  const [languageDrafts, setLanguageDrafts] = useState<Record<string, string>>({});
  const [adminUserId, setAdminUserId] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [locationInput, setLocationInput] = useState("");

  const {
    suggestions: locationSuggestions,
    isLoading: isLocationLoading,
    error: locationError,
    fetchPlaceDetails,
  } = useAddressSearch(locationInput);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("dnm-admin-credentials");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as { username: string; password: string };
      if (!parsed.username || !parsed.password) return;
      setCredentials(parsed);
      setFormCredentials(parsed);
    } catch {
      window.localStorage.removeItem("dnm-admin-credentials");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (formCredentials.username || formCredentials.password) return;
    const envUsername =
      ((import.meta as any).env?.VITE_ADMIN_USERNAME as string | undefined) ??
      ((import.meta as any).env?.VITE_ADMIN_EMAIL as string | undefined);
    const envPassword = (import.meta as any).env?.VITE_ADMIN_PASSWORD as string | undefined;
    if (envUsername || envPassword) {
      const next = { username: envUsername ?? "", password: envPassword ?? "" };
      setCredentials(next);
      setFormCredentials(next);
    }
  }, [formCredentials.username, formCredentials.password]);

  useEffect(() => {
    if (!credentials.username || !credentials.password) return;
    setIsChecking(true);
    setAuthError("");
    fetch("/api/admin/auth-check", {
      method: "GET",
      headers: {
        Authorization: buildAuthHeader(credentials.username, credentials.password),
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Invalid credentials.");
        }
        return response.json();
      })
      .then(() => {
        setIsAuthed(true);
        window.localStorage.setItem("dnm-admin-credentials", JSON.stringify(credentials));
      })
      .catch((error) => {
        setIsAuthed(false);
        setAuthError(error instanceof Error ? error.message : "Unable to verify credentials.");
      })
      .finally(() => {
        setIsChecking(false);
      });
  }, [credentials]);

  useEffect(() => {
    if (clinic.location && !locationInput) {
      setLocationInput(clinic.location);
    }
  }, [clinic.location, locationInput]);

  const clinicIdHint = useMemo(() => {
    if (!clinic.id) return "clinic-id";
    return clinic.id.trim();
  }, [clinic.id]);

  const handleLoginSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCredentials(formCredentials);
  };

  const handleClinicChange = (field: keyof ClinicProfile, value: string | number) => {
    setClinic((prev) => ({ ...prev, [field]: value }));
  };

  const handleHoursChange = (field: "weekdays" | "weekend", key: "start" | "end", value: string) => {
    setClinic((prev) => ({
      ...prev,
      hours: {
        ...prev.hours,
        [field]: { ...prev.hours?.[field], [key]: value },
      },
    }));
  };

  const handleSlotMinutesChange = (value: number) => {
    setClinic((prev) => ({
      ...prev,
      hours: {
        ...prev.hours,
        slotMinutes: value,
      },
    }));
  };

  const handleAddDoctor = () => {
    const draft = makeDoctorDraft(clinic.id);
    setDoctors((prev) => [...prev, draft]);
    setLanguageDrafts((prev) => ({ ...prev, [draft.id]: "" }));
  };

  const handleUpdateDoctor = (index: number, updates: Partial<DoctorDraft>) => {
    setDoctors((prev) => prev.map((doctor, idx) => (idx === index ? { ...doctor, ...updates } : doctor)));
  };

  const handleRemoveDoctor = (index: number) => {
    setDoctors((prev) => {
      const removed = prev[index];
      if (removed?.id) {
        setLanguageDrafts((drafts) => {
          if (!drafts[removed.id]) return drafts;
          const next = { ...drafts };
          delete next[removed.id];
          return next;
        });
      }
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const getDoctorLanguages = (doctor: DoctorDraft) =>
    (doctor.languages ?? []).map((language) => language.trim()).filter(Boolean);

  const languageOptions = useMemo(() => {
    const options = new Set(supportedLanguages.map(({ label }) => label));
    doctors.forEach((doctor) => {
      getDoctorLanguages(doctor).forEach((language) => options.add(language));
    });
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [doctors]);

  const handleLanguageDraftChange = (doctorId: string, value: string) => {
    setLanguageDrafts((prev) => ({ ...prev, [doctorId]: value }));
  };

  const handleAddDoctorLanguage = (index: number) => {
    const doctorId = doctors[index]?.id;
    if (!doctorId) return;
    setDoctors((prev) => {
      const next = [...prev];
      const doctor = next[index];
      const draft = (languageDrafts[doctorId] ?? "").trim();
      if (!draft) return prev;
      const languages = getDoctorLanguages(doctor);
      if (languages.some((language) => language.toLowerCase() === draft.toLowerCase())) return prev;
      next[index] = { ...doctor, languages: [...languages, draft] };
      return next;
    });
    setLanguageDrafts((prev) => ({ ...prev, [doctorId]: "" }));
  };

  const handleRemoveDoctorLanguage = (index: number, language: string) => {
    setDoctors((prev) => {
      const next = [...prev];
      const doctor = next[index];
      next[index] = {
        ...doctor,
        languages: getDoctorLanguages(doctor).filter((item) => item !== language),
      };
      return next;
    });
  };

  const handleAddDoctorAvailabilitySlot = (index: number) => {
    setDoctors((prev) =>
      prev.map((doctor, idx) =>
        idx === index
          ? {
              ...doctor,
              availability: [
                ...(doctor.availability ?? []),
                {
                  days: [],
                  startTime: "",
                  endTime: "",
                },
              ],
            }
          : doctor,
      ),
    );
  };

  const handleRemoveDoctorAvailabilitySlot = (doctorIndex: number, slotIndex: number) => {
    setDoctors((prev) =>
      prev.map((doctor, idx) =>
        idx === doctorIndex
          ? {
              ...doctor,
              availability: (doctor.availability ?? []).filter((_, index) => index !== slotIndex),
            }
          : doctor,
      ),
    );
  };

  const handleDoctorAvailabilityTimeChange = (
    doctorIndex: number,
    slotIndex: number,
    field: "startTime" | "endTime",
    value: string,
  ) => {
    setDoctors((prev) =>
      prev.map((doctor, idx) => {
        if (idx !== doctorIndex) return doctor;
        const availability = [...(doctor.availability ?? [])];
        const slot = availability[slotIndex];
        if (!slot) return doctor;
        availability[slotIndex] = { ...slot, [field]: value };
        return { ...doctor, availability };
      }),
    );
  };

  const handleToggleDoctorAvailabilityDay = (doctorIndex: number, slotIndex: number, day: string) => {
    setDoctors((prev) =>
      prev.map((doctor, idx) => {
        if (idx !== doctorIndex) return doctor;
        const availability = [...(doctor.availability ?? [])];
        const slot = availability[slotIndex];
        if (!slot) return doctor;
        const days = new Set(slot.days ?? []);
        if (days.has(day)) {
          days.delete(day);
        } else {
          days.add(day);
        }
        availability[slotIndex] = { ...slot, days: Array.from(days) };
        return { ...doctor, availability };
      }),
    );
  };

  const handleAddPhoto = () => {
    setPhotos((prev) => [...prev, { label: "", url: "" }]);
  };

  const handleUpdatePhoto = (index: number, updates: Partial<PhotoDraft>) => {
    setPhotos((prev) => prev.map((photo, idx) => (idx === index ? { ...photo, ...updates } : photo)));
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAddClosure = () => {
    setClosures((prev) => [
      ...prev,
      { startDate: "", endDate: "", reason: "" },
    ]);
  };

  const handleUpdateClosure = (index: number, updates: Partial<ClosureDraft>) => {
    setClosures((prev) => prev.map((closure, idx) => (idx === index ? { ...closure, ...updates } : closure)));
  };

  const handleRemoveClosure = (index: number) => {
    setClosures((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmitClinic = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError("");
    setSubmitSuccess(null);

    const validationErrors: string[] = [];
    const trimmedEmail = clinic.email?.trim() ?? "";
    const resolvedLocation = clinic.location.trim() || locationInput.trim();
    if (!clinic.id.trim()) validationErrors.push("Clinic ID is required.");
    if (!clinic.name.trim()) validationErrors.push("Clinic name is required.");
    if (!resolvedLocation) validationErrors.push("Location is required.");
    if (!clinic.image.trim()) validationErrors.push("Hero image URL is required.");
    if (!trimmedEmail) {
      validationErrors.push("Notification email is required.");
    } else if (!isValidEmail(trimmedEmail)) {
      validationErrors.push("Notification email must be valid.");
    }

    const invalidClosure = closures.find(
      (closure) => closure.endDate && closure.endDate < closure.startDate,
    );
    if (invalidClosure) {
      validationErrors.push("Closure end date must be after start date.");
    }

    if (validationErrors.length > 0) {
      setSubmitError(validationErrors.join(" "));
      return;
    }

    const slotMinutes = clinic.hours?.slotMinutes;
    const normalizedSlotMinutes =
      typeof slotMinutes === "number" && Number.isFinite(slotMinutes) && slotMinutes >= 10
        ? slotMinutes
        : undefined;

    const payload: AdminCreateClinicRequest = {
      clinic: {
        ...clinic,
        location: resolvedLocation,
        id: clinic.id.trim(),
        rating: Number(clinic.rating),
        specializations: [],
        googlePlaceId: clinic.googlePlaceId?.trim() ? clinic.googlePlaceId.trim() : undefined,
        phone: clinic.phone?.trim() ? clinic.phone.trim() : undefined,
        email: clinic.email?.trim() ? clinic.email.trim() : undefined,
        notificationEmailEnabled: true,
        notificationPhoneEnabled: false,
        notificationLineEnabled: false,
        hours: clinic.hours
          ? {
              ...clinic.hours,
              weekdays: {
                start: clinic.hours.weekdays.start.trim(),
                end: clinic.hours.weekdays.end.trim(),
              },
              weekend: {
                start: clinic.hours.weekend.start.trim(),
                end: clinic.hours.weekend.end.trim(),
              },
              closedDays: normalizeList(closedDaysText),
              slotMinutes: normalizedSlotMinutes,
            }
          : undefined,
        bookingClosures: closures
          .filter((closure) => closure.startDate)
          .map((closure) => ({
            startDate: closure.startDate,
            endDate: closure.endDate || undefined,
            reason: closure.reason || undefined,
            id:
              typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : `closure-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            createdAt: new Date().toISOString(),
          })),
        pricing:
          pricing.firstVisit || pricing.followUp || pricing.otherServices
            ? { ...pricing }
            : undefined,
        photos: photos.filter((photo) => photo.label && photo.url),
      },
      doctors: doctors
        .filter((doctor) => doctor.id && doctor.name)
        .map((doctor) => ({
          id: doctor.id,
          clinicId: clinic.id,
          name: doctor.name,
          specialization: doctor.specialization,
          languages: getDoctorLanguages(doctor),
          rating: Number(doctor.rating),
          nextAvailable: doctor.nextAvailable,
          availability:
            doctor.availability
              ?.map((slot) => ({
                days: (slot.days ?? []).map((day) => day.trim()).filter(Boolean),
                startTime: slot.startTime.trim(),
                endTime: slot.endTime.trim(),
              }))
              .filter((slot) => slot.days.length > 0 && slot.startTime && slot.endTime) ?? undefined,
        })),
      adminUserId: adminUserId || undefined,
      adminPassword: adminPassword || undefined,
    };

    try {
      const response = await fetch("/api/admin/clinics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: buildAuthHeader(credentials.username, credentials.password),
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const message = await response.json().catch(() => ({}));
        const issues = Array.isArray(message?.issues)
          ? message.issues
              .map((issue: { path?: string; message?: string }) => {
                const path = issue?.path ? `${issue.path}: ` : "";
                return `${path}${issue?.message ?? ""}`.trim();
              })
              .filter(Boolean)
              .join(" ")
          : "";
        throw new Error(issues || message?.error || "Unable to create clinic.");
      }
      const data = (await response.json()) as AdminCreateClinicResponse;
      setSubmitSuccess(data);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to create clinic.");
    }
  };

  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
          <h1 className="text-2xl font-semibold text-slate-900">Admin clinic onboarding</h1>
          <p className="mt-2 text-sm text-slate-500">
            Sign in to access the admin onboarding form.
          </p>
          <form className="mt-6 space-y-4" onSubmit={handleLoginSubmit}>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="admin-username">
                Username
              </label>
              <input
                id="admin-username"
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                value={formCredentials.username}
                onChange={(event) =>
                  setFormCredentials((prev) => ({ ...prev, username: event.target.value }))
                }
                placeholder="Enter admin username"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="admin-password">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                value={formCredentials.password}
                onChange={(event) =>
                  setFormCredentials((prev) => ({ ...prev, password: event.target.value }))
                }
                placeholder="Enter admin password"
                required
              />
            </div>
            {authError ? <p className="text-sm text-red-500">{authError}</p> : null}
            <button
              type="submit"
              disabled={isChecking}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {isChecking ? "Checking access..." : "Continue"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="rounded-2xl bg-white px-6 py-5 shadow">
          <h1 className="text-2xl font-semibold text-slate-900">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage clinics, onboard new ones, and view audit logs.
          </p>
          <nav className="mt-4 flex gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("clinics")}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
                activeTab === "clinics"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Clinics
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("onboard")}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
                activeTab === "onboard"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Onboard New Clinic
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("labels")}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
                activeTab === "labels"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Labels
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("logs")}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
                activeTab === "logs"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Audit Logs
            </button>
          </nav>
        </header>

        {activeTab === "clinics" && (
          <AdminClinicList username={credentials.username} password={credentials.password} />
        )}

        {activeTab === "labels" && (
          <AdminLabelsPanel username={credentials.username} password={credentials.password} />
        )}

        {activeTab === "logs" && (
          <AdminAuditLogsPanel username={credentials.username} password={credentials.password} />
        )}

        {activeTab === "onboard" && (
        <form onSubmit={handleSubmitClinic} className="space-y-6">
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-slate-900">Clinic basics</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="clinic-id">
                  Clinic ID
                </label>
                <input
                  id="clinic-id"
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={clinic.id}
                  onChange={(event) => handleClinicChange("id", event.target.value)}
                  placeholder="e.g. harbor-womens"
                  required
                />
                <p className="mt-1 text-xs text-slate-400">
                  Used for URLs and clinic admin login ({clinicIdHint}-admin).
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="clinic-name">
                  Clinic name
                </label>
                <input
                  id="clinic-name"
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={clinic.name}
                  onChange={(event) => handleClinicChange("name", event.target.value)}
                  placeholder="e.g. Harbor Women’s Clinic"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="clinic-type">
                  Type
                </label>
                <select
                  id="clinic-type"
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={clinic.type}
                  onChange={(event) => handleClinicChange("type", event.target.value as ClinicProfile["type"])}
                >
                  <option value="Clinic">Clinic</option>
                  <option value="Hospital">Hospital</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="clinic-location">
                  Location
                </label>
                <input
                  id="clinic-location"
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={locationInput}
                  onChange={(event) => setLocationInput(event.target.value)}
                  placeholder="Start typing address"
                  required
                />
                {isLocationLoading ? (
                  <p className="mt-2 text-xs text-slate-400">Searching addresses...</p>
                ) : locationError ? (
                  <p className="mt-2 text-xs text-rose-500">{locationError}</p>
                ) : null}
                {locationSuggestions.length > 0 ? (
                  <div className="mt-2 rounded-lg border border-slate-200 bg-white shadow-sm">
                    {locationSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.placeId}
                        type="button"
                        onClick={async () => {
                          try {
                            const formatted = await fetchPlaceDetails(suggestion.placeId);
                            handleClinicChange("location", formatted);
                            handleClinicChange("googlePlaceId", suggestion.placeId);
                            setLocationInput(formatted);
                          } catch (error) {
                            setSubmitError(
                              error instanceof Error ? error.message : "Unable to fetch place details.",
                            );
                          }
                        }}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                      >
                        {suggestion.description}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="clinic-image">
                  Hero image URL
                </label>
                <input
                  id="clinic-image"
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={clinic.image}
                  onChange={(event) => handleClinicChange("image", event.target.value)}
                  placeholder="https://..."
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="clinic-phone">
                  Phone
                </label>
                <input
                  id="clinic-phone"
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={clinic.phone ?? ""}
                  onChange={(event) => handleClinicChange("phone", event.target.value)}
                  placeholder="e.g. 0977-11-2233"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="clinic-google">
                  Google Place ID
                </label>
                <input
                  id="clinic-google"
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={clinic.googlePlaceId ?? ""}
                  onChange={(event) => handleClinicChange("googlePlaceId", event.target.value)}
                  placeholder="Auto-filled from location"
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-slate-900">Clinic hours</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">Weekdays</label>
                <div className="mt-2 flex gap-2">
                  <input
                    type="time"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={clinic.hours?.weekdays.start ?? ""}
                    onChange={(event) => handleHoursChange("weekdays", "start", event.target.value)}
                    required
                  />
                  <input
                    type="time"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={clinic.hours?.weekdays.end ?? ""}
                    onChange={(event) => handleHoursChange("weekdays", "end", event.target.value)}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Weekend</label>
                <div className="mt-2 flex gap-2">
                  <input
                    type="time"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={clinic.hours?.weekend.start ?? ""}
                    onChange={(event) => handleHoursChange("weekend", "start", event.target.value)}
                    required
                  />
                  <input
                    type="time"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={clinic.hours?.weekend.end ?? ""}
                    onChange={(event) => handleHoursChange("weekend", "end", event.target.value)}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="clinic-closed">
                  Closed days (comma separated)
                </label>
                <input
                  id="clinic-closed"
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={closedDaysText}
                  onChange={(event) => setClosedDaysText(event.target.value)}
                  placeholder="Wednesday, Sunday"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="clinic-slot-minutes">
                  Slot minutes
                </label>
                <input
                  id="clinic-slot-minutes"
                  type="number"
                  min="10"
                  max="120"
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={clinic.hours?.slotMinutes ?? 30}
                  onChange={(event) => handleSlotMinutesChange(Number(event.target.value))}
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-slate-900">Pricing</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="pricing-first">
                  First visit
                </label>
                <input
                  id="pricing-first"
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={pricing.firstVisit}
                  onChange={(event) => setPricing((prev) => ({ ...prev, firstVisit: event.target.value }))}
                  placeholder="¥3,000"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="pricing-follow">
                  Follow-up
                </label>
                <input
                  id="pricing-follow"
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={pricing.followUp}
                  onChange={(event) => setPricing((prev) => ({ ...prev, followUp: event.target.value }))}
                  placeholder="¥1,500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="pricing-other">
                  Other services
                </label>
                <textarea
                  id="pricing-other"
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  rows={2}
                  value={pricing.otherServices}
                  onChange={(event) =>
                    setPricing((prev) => ({ ...prev, otherServices: event.target.value }))
                  }
                  placeholder="PCR test ¥6,000, Vaccination ¥4,500"
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Photos</h2>
              <button
                type="button"
                onClick={handleAddPhoto}
                className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-600 hover:bg-slate-50"
              >
                Add photo
              </button>
            </div>
            <div className="mt-4 space-y-4">
              {photos.length === 0 ? (
                <p className="text-sm text-slate-500">No photos added yet.</p>
              ) : (
                photos.map((photo, index) => (
                  <div key={`photo-${index}`} className="rounded-xl border border-slate-200 p-4">
                    <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto]">
                      <input
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Label"
                        value={photo.label}
                        onChange={(event) => handleUpdatePhoto(index, { label: event.target.value })}
                      />
                      <input
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Image URL"
                        value={photo.url}
                        onChange={(event) => handleUpdatePhoto(index, { url: event.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(index)}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Booking closures</h2>
              <button
                type="button"
                onClick={handleAddClosure}
                className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-600 hover:bg-slate-50"
              >
                Add closure
              </button>
            </div>
            <div className="mt-4 space-y-4">
              {closures.length === 0 ? (
                <p className="text-sm text-slate-500">No closures added yet.</p>
              ) : (
                closures.map((closure, index) => (
                  <div key={`closure-${index}`} className="rounded-xl border border-slate-200 p-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        type="date"
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={closure.startDate}
                        onChange={(event) => handleUpdateClosure(index, { startDate: event.target.value })}
                      />
                      <input
                        type="date"
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={closure.endDate}
                        onChange={(event) => handleUpdateClosure(index, { endDate: event.target.value })}
                      />
                      <input
                        className="md:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={closure.reason}
                        onChange={(event) => handleUpdateClosure(index, { reason: event.target.value })}
                        placeholder="Reason (optional)"
                      />
                    </div>
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => handleRemoveClosure(index)}
                        className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-500 hover:bg-slate-50"
                      >
                        Remove closure
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-slate-900">Booking System</h2>
            <p className="mt-1 text-sm text-slate-500">
              Choose whether this clinic accepts appointment bookings through DocNearMe, or only wants their details listed.
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="radio"
                  name="bookingEnabled"
                  checked={clinic.bookingEnabled !== false}
                  onChange={() => handleClinicChange("bookingEnabled", true)}
                  className="h-4 w-4 text-[#3A12DB]"
                />
                <div>
                  <p className="text-sm font-medium text-slate-900">Enable booking</p>
                  <p className="text-xs text-slate-500">Patients can book appointments directly through the app.</p>
                </div>
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="radio"
                  name="bookingEnabled"
                  checked={clinic.bookingEnabled === false}
                  onChange={() => handleClinicChange("bookingEnabled", false)}
                  className="h-4 w-4 text-[#3A12DB]"
                />
                <div>
                  <p className="text-sm font-medium text-slate-900">Listing only</p>
                  <p className="text-xs text-slate-500">Clinic details are visible but patients cannot book through the app.</p>
                </div>
              </label>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-slate-900">Notifications</h2>
            <p className="mt-1 text-sm text-slate-500">
              Email is required for clinic booking notifications.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="clinic-email">
                  Notification email
                </label>
                <input
                  id="clinic-email"
                  type="email"
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={clinic.email ?? ""}
                  onChange={(event) => handleClinicChange("email", event.target.value)}
                  placeholder="clinic@example.com"
                  required
                />
              </div>
              <div className="space-y-2 pt-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked disabled />
                  <span>Email (required)</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-400">
                  <input type="checkbox" disabled />
                  <span>Phone (coming soon)</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-400">
                  <input type="checkbox" disabled />
                  <span>LINE Bot (coming soon)</span>
                </label>
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Doctors</h2>
              <button
                type="button"
                onClick={handleAddDoctor}
                className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-600 hover:bg-slate-50"
              >
                Add doctor
              </button>
            </div>
            <div className="mt-4 space-y-4">
              {doctors.length === 0 ? (
                <p className="text-sm text-slate-500">No doctors added yet.</p>
              ) : (
                doctors.map((doctor, index) => (
                  <div key={`doctor-${index}`} className="rounded-xl border border-slate-200 p-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Doctor ID"
                        value={doctor.id}
                        onChange={(event) => handleUpdateDoctor(index, { id: event.target.value })}
                      />
                      <input
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Doctor name"
                        value={doctor.name}
                        onChange={(event) => handleUpdateDoctor(index, { name: event.target.value })}
                      />
                      <input
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Specialization"
                        value={doctor.specialization}
                        onChange={(event) =>
                          handleUpdateDoctor(index, { specialization: event.target.value })
                        }
                      />
                      <div className="md:col-span-2">
                        <label className="text-xs font-medium text-slate-600">Languages spoken</label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {getDoctorLanguages(doctor).length > 0 ? (
                            getDoctorLanguages(doctor).map((languageItem) => (
                              <span
                                key={languageItem}
                                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600"
                              >
                                {languageItem}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDoctorLanguage(index, languageItem)}
                                  className="text-slate-400 hover:text-slate-600"
                                  aria-label={`Remove ${languageItem}`}
                                >
                                  ×
                                </button>
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">No languages set.</span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Select
                            value={languageDrafts[doctor.id] ?? ""}
                            onValueChange={(value) => handleLanguageDraftChange(doctor.id, value)}
                          >
                            <SelectTrigger className="min-w-[200px]">
                              <SelectValue placeholder="Select language" />
                            </SelectTrigger>
                            <SelectContent>
                              {languageOptions.map((languageOption) => (
                                <SelectItem key={languageOption} value={languageOption}>
                                  {languageOption}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <button
                            type="button"
                            onClick={() => handleAddDoctorLanguage(index)}
                            disabled={!languageDrafts[doctor.id]}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            + Add
                          </button>
                        </div>
                      </div>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="5"
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Rating"
                        value={doctor.rating}
                        onChange={(event) => handleUpdateDoctor(index, { rating: Number(event.target.value) })}
                      />
                    </div>
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-700">Availability schedule</p>
                        <button
                          type="button"
                          onClick={() => handleAddDoctorAvailabilitySlot(index)}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                        >
                          Add slot
                        </button>
                      </div>
                      {(doctor.availability ?? []).length === 0 ? (
                        <p className="text-xs text-slate-500">No availability set.</p>
                      ) : null}
                      {(doctor.availability ?? []).map((slot, slotIndex) => (
                        <div key={`doctor-${index}-slot-${slotIndex}`} className="rounded-lg border border-slate-200 p-3">
                          <div className="flex flex-wrap gap-2">
                            {weekdayOptions.map((day) => {
                              const isSelected = slot.days?.includes(day);
                              return (
                                <button
                                  key={`${index}-${slotIndex}-${day}`}
                                  type="button"
                                  onClick={() => handleToggleDoctorAvailabilityDay(index, slotIndex, day)}
                                  className={`rounded-full border px-3 py-1 text-xs transition ${
                                    isSelected
                                      ? "border-blue-500 bg-blue-50 text-blue-600"
                                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                                  }`}
                                >
                                  {day}
                                </button>
                              );
                            })}
                          </div>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div>
                              <label className="text-xs font-medium text-slate-600">Start time</label>
                              <input
                                type="time"
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                value={slot.startTime}
                                onChange={(event) =>
                                  handleDoctorAvailabilityTimeChange(index, slotIndex, "startTime", event.target.value)
                                }
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-slate-600">End time</label>
                              <input
                                type="time"
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                value={slot.endTime}
                                onChange={(event) =>
                                  handleDoctorAvailabilityTimeChange(index, slotIndex, "endTime", event.target.value)
                                }
                              />
                            </div>
                          </div>
                          <div className="mt-3 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleRemoveDoctorAvailabilitySlot(index, slotIndex)}
                              className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
                            >
                              Remove slot
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => handleRemoveDoctor(index)}
                        className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-500 hover:bg-slate-50"
                      >
                        Remove doctor
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-slate-900">Clinic admin login</h2>
            <p className="mt-1 text-sm text-slate-500">
              These credentials are used by the clinic to sign in on clinic.docnearme.app.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="clinic-admin-user">
                  Admin user ID
                </label>
                <input
                  id="clinic-admin-user"
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={adminUserId}
                  onChange={(event) => setAdminUserId(event.target.value)}
                  placeholder={`${clinicIdHint}-admin`}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="clinic-admin-password">
                  Admin password
                </label>
                <input
                  id="clinic-admin-password"
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                  placeholder={`clinic-${clinicIdHint}-2024`}
                />
              </div>
            </div>
          </section>

          {submitError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {submitError}
            </div>
          ) : null}
          {submitSuccess ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <p className="font-semibold">Clinic created successfully.</p>
              <div className="mt-2 text-sm">
                <p>Clinic ID: {submitSuccess.clinicId}</p>
                <p>Clinic admin user: {submitSuccess.adminUserId}</p>
                <p>Clinic admin password: {submitSuccess.adminPassword}</p>
              </div>
            </div>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-blue-700"
          >
            Create clinic
          </button>
        </form>
        )}
      </div>
    </div>
  );
}
