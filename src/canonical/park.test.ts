import { describe, expect, it } from "vitest";

import { canonicalParkSchema } from "./park.js";

const basePark = {
  id: "park_wikidata_Q1",
  sourceIds: { wikidata: "Q1" },
  name: {
    value: "Test Park",
    provenance: [{ source: "wikidata", sourceId: "Q1", retrievedAt: "2026-01-01T00:00:00.000Z" }],
  },
  aliases: [],
  countryCode: {
    value: "US",
    provenance: [{ source: "wikidata", sourceId: "Q1", retrievedAt: "2026-01-01T00:00:00.000Z" }],
  },
  status: "OPERATING" as const,
  coordinates: {
    value: { lat: 40.0, lng: -75.0 },
    provenance: [{ source: "wikidata", sourceId: "Q1", retrievedAt: "2026-01-01T00:00:00.000Z" }],
  },
  website: null,
  verification: { needsReview: false, reviewReasons: [] },
};

describe("canonicalParkSchema", () => {
  it("accepts a valid park", () => {
    expect(canonicalParkSchema.parse(basePark).id).toBe("park_wikidata_Q1");
  });

  it("rejects invalid country code", () => {
    expect(() =>
      canonicalParkSchema.parse({
        ...basePark,
        countryCode: { ...basePark.countryCode, value: "USA" },
      }),
    ).toThrow();
  });

  it("rejects out-of-range coordinates", () => {
    expect(() =>
      canonicalParkSchema.parse({
        ...basePark,
        coordinates: {
          value: { lat: 95, lng: 0 },
          provenance: basePark.coordinates.provenance,
        },
      }),
    ).toThrow();
  });
});
