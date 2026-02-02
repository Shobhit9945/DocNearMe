import { describe, expect, it } from "vitest";
import { buildClinicProfile } from "./clinic";

describe("buildClinicProfile immediateWoundCare", () => {
  it("defaults missing immediateWoundCare to false", () => {
    const profile = buildClinicProfile({
      clinicId: "demo",
      name: "Demo Clinic",
      type: "Clinic",
      rating: 4.5,
      patients: "1200+",
      distance: "2 km",
      location: "Beppu",
      image: "https://example.com/clinic.jpg",
      nextAvailability: "Tomorrow",
    });

    expect(profile.immediateWoundCare).toBe(false);
  });

  it("returns immediateWoundCare when set", () => {
    const profile = buildClinicProfile({
      clinicId: "demo",
      name: "Demo Clinic",
      type: "Clinic",
      rating: 4.5,
      patients: "1200+",
      distance: "2 km",
      location: "Beppu",
      image: "https://example.com/clinic.jpg",
      nextAvailability: "Tomorrow",
      immediateWoundCare: true,
    });

    expect(profile.immediateWoundCare).toBe(true);
  });
});
