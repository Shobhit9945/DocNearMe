import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { getClinicAuthHeader, getClinicSession } from "@/lib/clinic-auth";
import { useClinicProfile } from "@/lib/clinic-data";
import type { ClinicProfileUpdateRequest } from "@shared/api";

export default function ClinicInfo() {
  const session = getClinicSession();
  const clinicId = session?.clinicId;
  const { data } = useClinicProfile(clinicId);
  const clinic = data?.clinic;

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [image, setImage] = useState("");
  const [specializations, setSpecializations] = useState("");
  const [nextAvailability, setNextAvailability] = useState("");
  const [weekdayHours, setWeekdayHours] = useState("");
  const [weekendHours, setWeekendHours] = useState("");
  const [closedDays, setClosedDays] = useState("");
  const [firstVisit, setFirstVisit] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [otherServices, setOtherServices] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!clinic) return;
    setName(clinic.name ?? "");
    setLocation(clinic.location ?? "");
    setPhone(clinic.phone ?? "");
    setImage(clinic.image ?? "");
    setSpecializations((clinic.specializations ?? []).join(", "));
    setNextAvailability(clinic.nextAvailability ?? "");
    setWeekdayHours(clinic.hours?.weekdays ?? "");
    setWeekendHours(clinic.hours?.weekend ?? "");
    setClosedDays(clinic.hours?.closedDays ?? "");
    setFirstVisit(clinic.pricing?.firstVisit ?? "");
    setFollowUp(clinic.pricing?.followUp ?? "");
    setOtherServices(clinic.pricing?.otherServices ?? "");
    setPhotoUrls((clinic.photos ?? []).map((photo) => photo.url));
  }, [clinic]);

  const normalizedPhotos = useMemo(
    () =>
      photoUrls
        .map((url) => url.trim())
        .filter(Boolean)
        .map((url, index) => ({
          label: `Photo ${index + 1}`,
          url,
        })),
    [photoUrls],
  );

  const handleSave = async () => {
    if (!clinicId) {
      toast({ title: "Missing clinic session", variant: "destructive" });
      return;
    }

    const payload: ClinicProfileUpdateRequest = {
      name: name.trim(),
      location: location.trim(),
      phone: phone.trim(),
      image: image.trim(),
      specializations: specializations
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      nextAvailability: nextAvailability.trim(),
      hours: {
        weekdays: weekdayHours.trim(),
        weekend: weekendHours.trim(),
        closedDays: closedDays.trim(),
      },
      pricing: {
        firstVisit: firstVisit.trim(),
        followUp: followUp.trim(),
        otherServices: otherServices.trim(),
      },
      photos: normalizedPhotos,
    };

    setIsSaving(true);
    try {
      const response = await fetch(`/api/clinics/${clinicId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getClinicAuthHeader(),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error ?? "Unable to save clinic info.");
      }

      toast({ title: "Clinic info updated", description: "Changes are now visible to patients." });
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
        <h1 className="text-2xl font-bold text-gray-900">Clinic info</h1>
        <p className="text-gray-500 mt-1">
          Update hours, pricing, and photos in one place.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Basic info</h2>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Clinic name</label>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Address</label>
            <Input value={location} onChange={(event) => setLocation(event.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Phone</label>
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Primary image</label>
            <Input value={image} onChange={(event) => setImage(event.target.value)} placeholder="https://..." />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Specializations</label>
            <Input
              value={specializations}
              onChange={(event) => setSpecializations(event.target.value)}
              placeholder="Cardiology, Dermatology"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Next availability</label>
            <Input
              value={nextAvailability}
              onChange={(event) => setNextAvailability(event.target.value)}
              placeholder="Today, 4:30 PM"
            />
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </section>

        <section className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Clinic hours</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Weekdays</label>
              <Input value={weekdayHours} onChange={(event) => setWeekdayHours(event.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Weekend</label>
              <Input value={weekendHours} onChange={(event) => setWeekendHours(event.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Closed days</label>
            <Input value={closedDays} onChange={(event) => setClosedDays(event.target.value)} />
          </div>
          <Button variant="outline" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Update hours"}
          </Button>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Pricing</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">First visit</label>
              <Input value={firstVisit} onChange={(event) => setFirstVisit(event.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Follow-up</label>
              <Input value={followUp} onChange={(event) => setFollowUp(event.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Other services</label>
            <textarea
              className="w-full min-h-[90px] rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={otherServices}
              onChange={(event) => setOtherServices(event.target.value)}
            />
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </section>

        <section className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Photos</h2>
          <div className="space-y-3">
            {photoUrls.map((url, index) => (
              <div key={`${index}-photo`} className="flex items-center gap-3">
                <Input
                  value={url}
                  onChange={(event) => {
                    const next = [...photoUrls];
                    next[index] = event.target.value;
                    setPhotoUrls(next);
                  }}
                  placeholder={`Photo URL ${index + 1}`}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPhotoUrls(photoUrls.filter((_, idx) => idx !== index))}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => setPhotoUrls([...photoUrls, ""])}>
              Add photo URL
            </Button>
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </section>
      </div>
    </div>
  );
}
