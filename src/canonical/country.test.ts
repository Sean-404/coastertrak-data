import { describe, expect, it } from "vitest";

import {
  countryDisplayName,
  isKnownIsoCountryCode,
  normaliseCountryToIso,
} from "./country.js";

describe("country normalisation", () => {
  it("maps common aliases to ISO codes", () => {
    expect(normaliseCountryToIso("United States")).toBe("US");
    expect(normaliseCountryToIso("UK")).toBe("GB");
    expect(normaliseCountryToIso("Great Britain")).toBe("GB");
    expect(normaliseCountryToIso("Singapore")).toBe("SG");
    expect(normaliseCountryToIso("Vietnam")).toBe("VN");
    expect(normaliseCountryToIso("South Africa")).toBe("ZA");
    expect(normaliseCountryToIso("Coney Island")).toBe("US");
  });

  it("accepts two-letter codes", () => {
    expect(normaliseCountryToIso("sg")).toBe("SG");
    expect(normaliseCountryToIso("DK")).toBe("DK");
  });

  it("returns null for unknown labels", () => {
    expect(normaliseCountryToIso("Narnia")).toBeNull();
    expect(normaliseCountryToIso("")).toBeNull();
  });

  it("derives display names from ISO codes", () => {
    expect(countryDisplayName("SG")).toBe("Singapore");
    expect(countryDisplayName("US")).toBe("United States");
  });

  it("falls back to code for unknown ISO entries", () => {
    expect(countryDisplayName("ZZ")).toBe("ZZ");
  });

  it("identifies known ISO codes", () => {
    expect(isKnownIsoCountryCode("SG")).toBe(true);
    expect(isKnownIsoCountryCode("ZZ")).toBe(false);
  });
});
