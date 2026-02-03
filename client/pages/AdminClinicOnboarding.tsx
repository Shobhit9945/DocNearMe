import { useEffect, useMemo, useState } from "react";
import type { AdminCreateClinicRequest, AdminCreateClinicResponse, ClinicDoctor, ClinicProfile } from "@shared/api";

type DoctorDraft = ClinicDoctor & { languagesText: string };
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

const makeDoctorDraft = (clinicId: string): DoctorDraft => ({
  id:
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? `doc-${crypto.randomUUID()}`
      : `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  clinicId,
  name: "",
  specialization: "",
  languages: [],
  languagesText: "",
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
  const [adminUserId, setAdminUserId] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

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
      headers: { Authorization: buildAuthHeader(credentials.username, credentials.password) },
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
    setDoctors((prev) => [...prev, makeDoctorDraft(clinic.id)]);
  };

  const handleUpdateDoctor = (index: number, updates: Partial<DoctorDraft>) => {
    setDoctors((prev) => prev.map((doctor, idx) => (idx === index ? { ...doctor, ...updates } : doctor)));
  };

  const handleRemoveDoctor = (index: number) => {
    setDoctors((prev) => prev.filter((_, idx) => idx !== index));
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

    const payload: AdminCreateClinicRequest = {
      clinic: {
        ...clinic,
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
              closedDays: normalizeList(closedDaysText),
              slotMinutes: clinic.hours.slotMinutes ? Number(clinic.hours.slotMinutes) : undefined,
            }
          : undefined,
        bookingClosures: closures
          .filter((closure) => closure.startDate)
          .map((closure) => ({
            startDate: closure.startDate,
            endDate: closure.endDate || undefined,
            reason: closure.reason || undefined,
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
          languages: normalizeList(doctor.languagesText),
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
        throw new Error(message?.error ?? "Unable to create clinic.");
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
          <h1 className="text-2xl font-semibold text-slate-900">Clinic onboarding</h1>
          <p className="mt-1 text-sm text-slate-500">
            Add a new clinic, create its admin login, and register doctors in one flow.
          </p>
        </header>

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
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="clinic-rating">
                  Rating
                </label>
                <input
                  id="clinic-rating"
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={clinic.rating}
                  onChange={(event) => handleClinicChange("rating", Number(event.target.value))}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="clinic-patients">
                  Patients label
                </label>
                <input
                  id="clinic-patients"
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={clinic.patients}
                  onChange={(event) => handleClinicChange("patients", event.target.value)}
                  placeholder="e.g. 4K+ patients"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="clinic-distance">
                  Distance label
                </label>
                <input
                  id="clinic-distance"
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={clinic.distance}
                  onChange={(event) => handleClinicChange("distance", event.target.value)}
                  placeholder="e.g. 8 km away"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="clinic-location">
                  Location
                </label>
                <input
                  id="clinic-location"
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={clinic.location}
                  onChange={(event) => handleClinicChange("location", event.target.value)}
                  placeholder="Clinic address or neighborhood"
                  required
                />
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
                <label className="text-sm font-medium text-slate-700" htmlFor="clinic-next">
                  Next availability
                </label>
                <input
                  id="clinic-next"
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={clinic.nextAvailability}
                  onChange={(event) => handleClinicChange("nextAvailability", event.target.value)}
                  placeholder="e.g. Today, 6:10 PM"
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
                  placeholder="Optional"
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
                      <input
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Languages (comma separated)"
                        value={doctor.languagesText}
                        onChange={(event) =>
                          handleUpdateDoctor(index, { languagesText: event.target.value })
                        }
                      />
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
                      <input
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Next available"
                        value={doctor.nextAvailable}
                        onChange={(event) =>
                          handleUpdateDoctor(index, { nextAvailable: event.target.value })
                        }
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
      </div>
    </div>
  );
}
