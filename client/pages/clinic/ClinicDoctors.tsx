import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { getClinicAuthHeader, getClinicSession } from "@/lib/clinic-auth";
import { useClinicDoctors } from "@/lib/clinic-data";
import type { ClinicDoctor, ClinicDoctorsUpdateRequest } from "@shared/api";

export default function ClinicDoctors() {
  const session = getClinicSession();
  const clinicId = session?.clinicId;
  const { data } = useClinicDoctors(clinicId);
  const [doctors, setDoctors] = useState<ClinicDoctor[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [languageDrafts, setLanguageDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data?.doctors) return;
    setDoctors(data.doctors);
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

  const handleRemove = (index: number) => {
    setDoctors((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAdd = () => {
    const newId = `doc-${Date.now()}`;
    setDoctors((prev) => [
      ...prev,
      {
        id: newId,
        clinicId: clinicId ?? "",
        name: "",
        specialization: "",
        languages: ["English"],
        rating: 4.5,
        nextAvailable: "Schedule TBD",
        availability: "",
      },
    ]);
  };

  const handleSave = async () => {
    if (!clinicId) {
      toast({ title: "Missing clinic session", variant: "destructive" });
      return;
    }

    const payload: ClinicDoctorsUpdateRequest = {
      doctors: doctors.map((doctor) => ({
        ...doctor,
        clinicId,
        name: doctor.name.trim(),
        specialization: doctor.specialization.trim(),
        availability: doctor.availability?.trim(),
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
        throw new Error(error?.error ?? "Unable to save doctors.");
      }

      toast({ title: "Doctors updated", description: "Patient view is now up to date." });
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Doctors & staff</h1>
        <p className="text-gray-500 mt-1">
          Keep schedules up to date so patients see the right availability.
        </p>
      </header>

      <section className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Availability</h2>
        <div className="space-y-4">
          {doctors.map((doctor, index) => (
            <div key={doctor.id} className="border border-gray-100 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Name</label>
                  <Input
                    value={doctor.name}
                    onChange={(event) => handleFieldChange(index, "name", event.target.value)}
                    placeholder="Dr. Name"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Specialization</label>
                  <Input
                    value={doctor.specialization}
                    onChange={(event) => handleFieldChange(index, "specialization", event.target.value)}
                    placeholder="Dermatology"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Availability</label>
                  <Input
                    value={doctor.availability ?? ""}
                    onChange={(event) => handleFieldChange(index, "availability", event.target.value)}
                    placeholder="Mon-Fri 09:00-18:00"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500 block">Languages spoken</label>
                <div className="flex flex-wrap gap-2">
                  {(doctor.languages ?? ["English"]).map((language) => (
                    <span
                      key={language}
                      className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600"
                    >
                      {language}
                      <button
                        type="button"
                        onClick={() => handleRemoveLanguage(index, language)}
                        className="text-gray-400 hover:text-gray-600"
                        aria-label={`Remove ${language}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Input
                    value={languageDrafts[doctor.id] ?? ""}
                    onChange={(event) => handleLanguageDraftChange(doctor.id, event.target.value)}
                    placeholder="Add language"
                    className="max-w-xs"
                  />
                  <Button type="button" variant="outline" onClick={() => handleAddLanguage(index)}>
                    + Add
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-end text-xs text-gray-500">
                <Button type="button" variant="outline" onClick={() => handleRemove(index)}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Add doctor</h2>
        <p className="text-sm text-gray-500">Add new clinicians to display in the patient directory.</p>
        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={handleAdd}>
            Add doctor
          </Button>
          <Button type="button" variant="outline" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </section>
    </div>
  );
}
