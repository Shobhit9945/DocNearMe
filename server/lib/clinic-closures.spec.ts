import { describe, expect, it } from "vitest";
import { validateClinicClosureDates } from "./clinic-closures";

describe("validateClinicClosureDates", () => {
  it("rejects invalid date format", () => {
    const result = validateClinicClosureDates({ startDate: "2026/02/03" });
    expect(result.ok).toBe(false);
  });

  it("requires endDate >= startDate", () => {
    const result = validateClinicClosureDates({ startDate: "2026-02-05", endDate: "2026-02-03" });
    expect(result.ok).toBe(false);
  });

  it("fills endDate when missing", () => {
    const result = validateClinicClosureDates({ startDate: "2026-02-03" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.endDate).toBe("2026-02-03");
    }
  });

  it("rejects partial time ranges", () => {
    const result = validateClinicClosureDates({ startDate: "2026-02-03", startTime: "09:00" });
    expect(result.ok).toBe(false);
  });

  it("rejects end time before start time", () => {
    const result = validateClinicClosureDates({
      startDate: "2026-02-03",
      startTime: "14:00",
      endTime: "09:00",
    });
    expect(result.ok).toBe(false);
  });

  it("accepts valid time ranges", () => {
    const result = validateClinicClosureDates({
      startDate: "2026-02-03",
      startTime: "09:00",
      endTime: "12:00",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.startTime).toBe("09:00");
      expect(result.endTime).toBe("12:00");
    }
  });
});
