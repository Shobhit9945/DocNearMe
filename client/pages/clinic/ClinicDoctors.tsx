import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { getClinicAuthHeader, getClinicSession } from "@/lib/clinic-auth";
import { useClinicDoctors } from "@/lib/clinic-data";
import { useTranslation } from "@/lib/i18n";
import { supportedLanguages } from "@/lib/translations";
import type { ClinicDoctor, ClinicDoctorsUpdateRequest } from "@shared/api";
import { TranslatedText } from "@/components/TranslatedText";

export default function ClinicDoctors() {
  const session = getClinicSession();
  const { t } = useTranslation();
  const clinicId = session?.clinicId;
  const { data } = useClinicDoctors(clinicId);
  const [doctors, setDoctors] = useState<ClinicDoctor[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [editingDoctors, setEditingDoctors] = useState<Record<string, boolean>>({});
  const [languageDrafts, setLanguageDrafts] = useState<Record<string, string>>({});
  const createDoctorId = () => {
    const existingIds = new Set(doctors.map((doctor) => doctor.id));
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? `doc-${crypto.randomUUID()}`
          : `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      if (!existingIds.has(candidate)) return candidate;
    }
    return `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  };
  const weekdayOptions = useMemo(
    () => [
      { value: "Mon", label: t("Mon") },
      { value: "Tue", label: t("Tue") },
      { value: "Wed", label: t("Wed") },
      { value: "Thu", label: t("Thu") },
      { value: "Fri", label: t("Fri") },
      { value: "Sat", label: t("Sat") },
      { value: "Sun", label: t("Sun") },
    ],
    [t],
  );
  const languageOptions = useMemo(() => {
    const options = new Set(supportedLanguages.map(({ label }) => label));
    doctors.forEach((doctor) => {
      (doctor.languages ?? []).forEach((languageItem) => options.add(languageItem));
    });
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [doctors]);

  useEffect(() => {
    if (!data?.doctors) return;
    setDoctors(
      data.doctors.map((doctor) => ({
        ...doctor,
        availability: Array.isArray(doctor.availability) ? doctor.availability : [],
      })),
    );
  }, [data]);

  const handleFieldChange = (index: number, field: keyof ClinicDoctor, value: string) => {
    setDoctors((prev) => {
      const next = [...prev];
      const entry = { ...next[index], [field]: value };
      next[index] = entry;
      return next;
    });
  };

  const handleLanguageDraftChange = (doctorId: string, value: string) => {
    setLanguageDrafts((prev) => ({ ...prev, [doctorId]: value }));
  };

  const handleAddLanguage = (index: number) => {
    const doctorId = doctors[index]?.id;
    setDoctors((prev) => {
      const next = [...prev];
      const doctor = next[index];
      const draft = languageDrafts[doctor.id]?.trim();
      if (!draft) return prev;
      const languages = doctor.languages ?? [];
      const exists = languages.some((language) => language.toLowerCase() === draft.toLowerCase());
      if (exists) return prev;
      next[index] = { ...doctor, languages: [...languages, draft] };
      return next;
    });
    if (doctorId) {
      setLanguageDrafts((prev) => ({ ...prev, [doctorId]: "" }));
    }
  };

  const handleRemoveLanguage = (index: number, language: string) => {
    setDoctors((prev) => {
      const next = [...prev];
      const doctor = next[index];
      next[index] = {
        ...doctor,
        languages: (doctor.languages ?? []).filter((item) => item !== language),
      };
      return next;
    });
  };

  const handleRemove = (doctorId: string) => {
    setDoctors((prev) => prev.filter((doctor) => doctor.id !== doctorId));
    setEditingDoctors((prev) => {
      if (!prev[doctorId]) return prev;
      const next = { ...prev };
      delete next[doctorId];
      return next;
    });
    setLanguageDrafts((prev) => {
      if (!prev[doctorId]) return prev;
      const next = { ...prev };
      delete next[doctorId];
      return next;
    });
  };

  const handleAddAvailabilitySlot = (index: number) => {
    setDoctors((prev) => {
      const next = [...prev];
      const doctor = next[index];
      next[index] = {
        ...doctor,
        availability: [
          ...(doctor.availability ?? []),
          {
            days: [],
            startTime: "",
            endTime: "",
          },
        ],
      };
      return next;
    });
  };

  const handleRemoveAvailabilitySlot = (doctorIndex: number, slotIndex: number) => {
    setDoctors((prev) => {
      const next = [...prev];
      const doctor = next[doctorIndex];
      next[doctorIndex] = {
        ...doctor,
        availability: (doctor.availability ?? []).filter((_, index) => index !== slotIndex),
      };
      return next;
    });
  };

  const handleAvailabilityTimeChange = (
    doctorIndex: number,
    slotIndex: number,
    field: "startTime" | "endTime",
    value: string,
  ) => {
    setDoctors((prev) => {
      const next = [...prev];
      const doctor = next[doctorIndex];
      const availability = [...(doctor.availability ?? [])];
      const slot = availability[slotIndex];
      if (!slot) return prev;
      availability[slotIndex] = { ...slot, [field]: value };
      next[doctorIndex] = { ...doctor, availability };
      return next;
    });
  };

  const handleToggleAvailabilityDay = (doctorIndex: number, slotIndex: number, day: string) => {
    setDoctors((prev) => {
      const next = [...prev];
      const doctor = next[doctorIndex];
      const availability = [...(doctor.availability ?? [])];
      const slot = availability[slotIndex];
      if (!slot) return prev;
      const days = new Set(slot.days ?? []);
      if (days.has(day)) {
        days.delete(day);
      } else {
        days.add(day);
      }
      availability[slotIndex] = { ...slot, days: Array.from(days) };
      next[doctorIndex] = { ...doctor, availability };
      return next;
    });
  };

  const handleToggleEdit = (doctorId: string) => {
    setEditingDoctors((prev) => ({ ...prev, [doctorId]: !prev[doctorId] }));
  };

  const handleAdd = () => {
    const newId = createDoctorId();
    setDoctors((prev) => [
      ...prev,
      {
        id: newId,
        clinicId: clinicId ?? "",
        name: "",
        specialization: "",
        languages: ["English"],
        rating: 4.5,
        nextAvailable: t("Schedule TBD"),
        availability: [],
      },
    ]);
    setEditingDoctors((prev) => ({ ...prev, [newId]: true }));
  };

  const handleSave = async () => {
    if (!clinicId) {
      toast({ title: t("Missing clinic session"), variant: "destructive" });
      return;
    }

    const payload: ClinicDoctorsUpdateRequest = {
      doctors: doctors.map((doctor) => ({
        ...doctor,
        clinicId,
        name: doctor.name.trim(),
        specialization: doctor.specialization.trim(),
        availability:
          doctor.availability
            ?.map((slot) => ({
              days: (slot.days ?? []).map((day) => day.trim()).filter(Boolean),
              startTime: slot.startTime.trim(),
              endTime: slot.endTime.trim(),
            }))
            .filter((slot) => slot.days.length > 0 && slot.startTime && slot.endTime) ?? undefined,
        languages: (doctor.languages ?? [])
          .map((language) => language.trim())
          .filter((language) => language.length > 0),
      })),
    };

    setIsSaving(true);
    try {
      const response = await fetch(`/api/clinics/${clinicId}/doctors`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getClinicAuthHeader(),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error ?? t("Unable to save doctors."));
      }

      toast({ title: t("Doctors updated"), description: t("Patient view is now up to date.") });
    } catch (error) {
      toast({
        title: t("Save failed"),
        description: error instanceof Error ? error.message : t("Please try again."),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">{t("Doctors & staff")}</h1>
        <p className="text-gray-500 mt-1">
          {t("Keep schedules up to date so patients see the right times.")}
        </p>
      </header>

      <section className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">{t("Doctors")}</h2>
        <div className="space-y-4">
          {doctors.map((doctor, index) => {
            const specializationFallback = doctor.specialization?.trim() ?? "";
            const isEditing = editingDoctors[doctor.id] ?? false;
            const visibleLanguages =
              doctor.languages && doctor.languages.length > 0 ? doctor.languages : [t("English")];
            return (
              <div key={doctor.id} className="border border-gray-100 rounded-lg p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {doctor.name.trim().length > 0 ? (
                        <TranslatedText text={doctor.name} inline />
                      ) : (
                        t("Unnamed doctor")
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {specializationFallback ? (
                        <TranslatedText text={specializationFallback} inline />
                      ) : (
                        t("Add specialization")
                      )}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                      {visibleLanguages.map((languageItem) => (
                        <span key={languageItem} className="rounded-full border border-gray-200 px-2 py-0.5">
                          {t(languageItem)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => handleToggleEdit(doctor.id)}>
                      {isEditing ? t("Close") : t("Edit")}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => handleRemove(doctor.id)}>
                      {t("Remove")}
                    </Button>
                  </div>
                </div>
                {isEditing ? (
                  <div className="space-y-4 border-t border-gray-100 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-medium text-gray-500 block mb-1">{t("Name")}</label>
                        <Input
                          value={doctor.name}
                          onChange={(event) => handleFieldChange(index, "name", event.target.value)}
                          placeholder={t("Dr. Name")}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 block mb-1">{t("Specialization")}</label>
                        <Input
                          value={doctor.specialization ?? ""}
                          onChange={(event) => handleFieldChange(index, "specialization", event.target.value)}
                          placeholder={t("e.g. Cardiology")}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 block mb-1">{t("Schedule")}</label>
                        <div className="space-y-3">
                          {(doctor.availability ?? []).length === 0 ? (
                            <p className="text-xs text-gray-400">{t("No schedule set")}</p>
                          ) : null}
                          {(doctor.availability ?? []).map((slot, slotIndex) => (
                            <div
                              key={`${doctor.id}-slot-${slotIndex}`}
                              className="rounded-lg border border-gray-100 p-3"
                            >
                              <div className="space-y-3">
                                <div>
                                  <p className="text-xs font-medium text-gray-500">{t("Days")}</p>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {weekdayOptions.map((day) => {
                                      const isSelected = slot.days?.includes(day.value);
                                      return (
                                        <button
                                          key={`${doctor.id}-${slotIndex}-${day.value}`}
                                          type="button"
                                          onClick={() => handleToggleAvailabilityDay(index, slotIndex, day.value)}
                                          className={`rounded-full border px-3 py-1 text-xs transition ${
                                            isSelected
                                              ? "border-blue-500 bg-blue-50 text-blue-600"
                                              : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                                          }`}
                                        >
                                          {day.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                  <div>
                                    <label className="text-xs font-medium text-gray-500 block mb-1">
                                      {t("Start time")}
                                    </label>
                                    <Input
                                      type="time"
                                      value={slot.startTime}
                                      onChange={(event) =>
                                        handleAvailabilityTimeChange(index, slotIndex, "startTime", event.target.value)
                                      }
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-gray-500 block mb-1">
                                      {t("End time")}
                                    </label>
                                    <Input
                                      type="time"
                                      value={slot.endTime}
                                      onChange={(event) =>
                                        handleAvailabilityTimeChange(index, slotIndex, "endTime", event.target.value)
                                      }
                                    />
                                  </div>
                                </div>
                                <div className="flex justify-end">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRemoveAvailabilitySlot(index, slotIndex)}
                                  >
                                    {t("Remove slot")}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                          <Button type="button" variant="outline" onClick={() => handleAddAvailabilitySlot(index)}>
                            {t("Add schedule slot")}
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-500 block">{t("Languages spoken")}</label>
                      <div className="flex flex-wrap gap-2">
                        {(doctor.languages ?? [t("English")]).map((languageItem) => {
                          const label = t(languageItem);
                          return (
                            <span
                              key={languageItem}
                              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600"
                            >
                              {label}
                              <button
                                type="button"
                                onClick={() => handleRemoveLanguage(index, languageItem)}
                                className="text-gray-400 hover:text-gray-600"
                                aria-label={t("Remove {language}", `Remove ${label}`).replace("{language}", label)}
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Select
                          value={languageDrafts[doctor.id] ?? ""}
                          onValueChange={(value) => handleLanguageDraftChange(doctor.id, value)}
                        >
                          <SelectTrigger className="min-w-[200px]">
                            <SelectValue placeholder={t("Select language")} />
                          </SelectTrigger>
                          <SelectContent>
                            {languageOptions.map((languageOption) => (
                              <SelectItem key={languageOption} value={languageOption}>
                                {t(languageOption)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleAddLanguage(index)}
                          disabled={!languageDrafts[doctor.id]}
                        >
                          {t("+ Add")}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">{t("Add doctor")}</h2>
        <p className="text-sm text-gray-500">{t("Add new clinicians to display in the patient directory.")}</p>
        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={handleAdd}>
            {t("Add doctor")}
          </Button>
          <Button type="button" variant="outline" onClick={handleSave} disabled={isSaving}>
            {isSaving ? t("Saving...") : t("Save changes")}
          </Button>
        </div>
      </section>
    </div>
  );
}
