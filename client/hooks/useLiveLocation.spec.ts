import { describe, expect, it } from "vitest";
import { getGeocodingErrorMessage, parseGeocodingResponse } from "./useLiveLocation";

describe("getGeocodingErrorMessage", () => {
  it("returns a detailed message for request denied", () => {
    expect(getGeocodingErrorMessage({ status: "REQUEST_DENIED" })).toBe(
      "Geocoding request denied. Please verify your API key, billing, and restrictions.",
    );
  });

  it("returns an auth message for 403 responses", () => {
    expect(getGeocodingErrorMessage({ httpStatus: 403 })).toBe(
      "Geocoding request unauthorized. Please verify your Google Maps API key.",
    );
  });
});

describe("parseGeocodingResponse", () => {
  it("returns the formatted address when available", () => {
    expect(
      parseGeocodingResponse({
        status: "OK",
        results: [{ formatted_address: "123 Test St" }],
      }),
    ).toBe("123 Test St");
  });

  it("throws a helpful error when zero results are returned", () => {
    expect(() =>
      parseGeocodingResponse({
        status: "ZERO_RESULTS",
        results: [],
      }),
    ).toThrow("No address results found for this location.");
  });
});
