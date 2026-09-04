import { describe, expect, it } from "vitest";

import type { CanonicalCoaster } from "../canonical/coaster.js";
import type { CanonicalPark } from "../canonical/park.js";
import { validateCatalog } from "./rules.js";

function prov(sourceId = "Q1") {
  return [{ source: "wikidata", sourceId, retrievedAt: "2026-01-01T00:00:00.000Z" }];
}

describe("validateCatalog", () => {
  const park: CanonicalPark = {
    id: "park_wikidata_Q789078",
    sourceIds: { wikidata: "Q789078" },
    name: { value: "Universal Studios Singapore", provenance: prov("Q789078") },
    aliases: [],
    countryCode: { value: "SG", provenance: prov("Q789078") },
    status: "OPERATING",
    coordinates: { value: { lat: 1.254, lng: 103.824 }, provenance: prov("Q789078") },
    website: null,
    verification: { needsReview: false, reviewReasons: [] },
  };

  it("flags missing park linkage as error", () => {
    const coaster: CanonicalCoaster = {
      id: "coaster_wikidata_Q8888888",
      sourceIds: { wikidata: "Q8888888" },
      name: { value: "Son of Beast", provenance: prov("Q8888888") },
      aliases: [],
      parkId: null,
      countryCode: { value: "US", provenance: prov("Q8888888") },
      manufacturer: null,
      model: null,
      coasterType: null,
      status: "REMOVED",
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

    const result = validateCatalog({
      parks: [park],
      coasters: [coaster],
      sourceRunId: "test",
    });

    expect(result.report.findings.some((f) => f.code === "missing_park")).toBe(true);
    expect(result.reviewItems.some((i) => i.type === "MISSING_DATA")).toBe(true);
  });

  it("flags suspicious height outliers", () => {
    const coaster: CanonicalCoaster = {
      id: "coaster_wikidata_Q7777777",
      sourceIds: { wikidata: "Q7777777" },
      name: { value: "Hyperion", provenance: prov("Q7777777") },
      aliases: [],
      parkId: park.id,
      countryCode: { value: "PL", provenance: prov("Q7777777") },
      manufacturer: null,
      model: null,
      coasterType: null,
      status: "OPERATING",
      openingDate: null,
      closingDate: null,
      height: { value: { value: 250, unit: "m" }, provenance: prov("Q7777777"), confidence: "LOW" },
      speed: null,
      length: null,
      inversions: null,
      duration: null,
      coordinates: null,
      description: null,
      imageUrl: null,
      verification: { needsReview: false, reviewReasons: [] },
    };

    const result = validateCatalog({
      parks: [park],
      coasters: [coaster],
      sourceRunId: "test",
    });

    expect(result.report.findings.some((f) => f.code === "stat_outlier_height")).toBe(true);
  });

  it("queues coaster field completeness gaps with public path metadata", () => {
    const coaster: CanonicalCoaster = {
      id: "coaster_wikidata_Q6666666",
      sourceIds: { wikidata: "Q6666666", coastertrak: "42" },
      name: { value: "Nemesis", provenance: prov("Q6666666") },
      aliases: [],
      parkId: park.id,
      countryCode: { value: "SG", provenance: prov("Q6666666") },
      manufacturer: null,
      model: null,
      coasterType: { value: "steel", provenance: prov("Q6666666") },
      status: "OPERATING",
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

    const result = validateCatalog({
      parks: [park],
      coasters: [coaster],
      sourceRunId: "test",
    });

    const missing = result.reviewItems.find(
      (i) => i.type === "MISSING_DATA" && i.entityId === coaster.id,
    );
    expect(missing).toMatchObject({
      type: "MISSING_DATA",
      field: "height",
      dbId: 42,
      publicPath: "/coasters/nemesis-42",
      parkName: park.name.value,
    });
    expect(missing && "fields" in missing ? missing.fields : []).toEqual([
      "height",
      "speed",
      "length",
      "manufacturer",
      "image",
      "opening_year",
    ]);
    expect(result.report.findings.some((f) => f.code === "missing_coaster_fields")).toBe(true);
  });
});
