import { describe, expect, it } from "vitest";

import { canonicalCoasterSchema } from "./coaster.js";

const baseCoaster = {
  id: "coaster_wikidata_Q2",
  sourceIds: { wikidata: "Q2" },
  name: {
    value: "Test Coaster",
    provenance: [{ source: "wikidata", sourceId: "Q2", retrievedAt: "2026-01-01T00:00:00.000Z" }],
  },
  aliases: [],
  parkId: "park_wikidata_Q1",
  countryCode: {
    value: "US",
    provenance: [{ source: "derived", retrievedAt: "2026-01-01T00:00:00.000Z" }],
  },
  manufacturer: null,
  model: null,
  coasterType: null,
  status: "OPERATING" as const,
  openingDate: null,
  closingDate: null,
  height: null,
  speed: null,
  length: null,
  inversions: null,
  duration: null,
  coordinates: null,
  description: null,
  imageUrl: null,
  verification: { needsReview: false, reviewReasons: [] },
};

describe("canonicalCoasterSchema", () => {
  it("accepts a valid coaster", () => {
    expect(canonicalCoasterSchema.parse(baseCoaster).status).toBe("OPERATING");
  });

  it("accepts REMOVED historical coasters", () => {
    const parsed = canonicalCoasterSchema.parse({
      ...baseCoaster,
      status: "REMOVED",
      closingDate: {
        value: "2012-11-20",
        provenance: [{ source: "wikidata", retrievedAt: "2026-01-01T00:00:00.000Z" }],
      },
    });
    expect(parsed.status).toBe("REMOVED");
  });

  it("rejects invalid opening date format", () => {
    expect(() =>
      canonicalCoasterSchema.parse({
        ...baseCoaster,
        openingDate: {
          value: "not-a-date",
          provenance: [{ source: "wikidata", retrievedAt: "2026-01-01T00:00:00.000Z" }],
        },
      }),
    ).toThrow();
  });
});
