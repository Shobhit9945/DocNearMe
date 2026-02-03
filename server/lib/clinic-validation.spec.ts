import { describe, expect, it } from "vitest";
import { isValidNotificationEmail } from "./clinic-validation";

describe("isValidNotificationEmail", () => {
  it("accepts valid email", () => {
    expect(isValidNotificationEmail("clinic@example.com")).toBe(true);
  });

  it("rejects invalid email", () => {
    expect(isValidNotificationEmail("clinic@")).toBe(false);
  });
});
