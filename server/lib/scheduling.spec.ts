import { describe, expect, it } from "vitest";
import { getDateKey, isSlotInFutureJst } from "./scheduling";

describe("isSlotInFutureJst", () => {
  const now = new Date(Date.UTC(2026, 1, 3, 6, 0, 0)); // 2026-02-03 15:00 JST
  const todayKey = getDateKey(now);

  it("returns false for past dates", () => {
    expect(isSlotInFutureJst("2026-02-02", "05:00 PM", now)).toBe(false);
  });

  it("returns true for future dates", () => {
    expect(isSlotInFutureJst("2026-02-04", "05:00 PM", now)).toBe(true);
  });

  it("compares slots against current JST minutes", () => {
    expect(isSlotInFutureJst(todayKey, "02:00 PM", now)).toBe(false);
    expect(isSlotInFutureJst(todayKey, "04:00 PM", now)).toBe(true);
  });

  it("uses fallback date when slot label is invalid", () => {
    const future = new Date(Date.UTC(2026, 1, 3, 6, 30, 0)); // 15:30 JST
    const past = new Date(Date.UTC(2026, 1, 3, 5, 30, 0)); // 14:30 JST
    expect(isSlotInFutureJst(todayKey, "invalid", now, future)).toBe(true);
    expect(isSlotInFutureJst(todayKey, "invalid", now, past)).toBe(false);
  });
});
