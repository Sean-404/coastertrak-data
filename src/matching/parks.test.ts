import { describe, expect, it } from "vitest";

import type { CanonicalPark } from "../canonical/park.js";
import { findParkDuplicateCandidates } from "./parks.js";

function makePark(id: string, name: string, country: string, lat: number, lng: number): CanonicalPark {
  const prov = [{ source: "test", retrievedAt: "2026-01-01T00:00:00.000Z" }];
  return {
    id,
    sourceIds: { wikidata: id.replace("park_wikidata_", "") },
    name: { value: name, provenance: prov },
    aliases: [],
    countryCode: { value: country, provenance: prov },
    status: "OPERATING",
    coordinates: { value: { lat, lng }, provenance: prov },
    website: null,
    verification: { needsReview: false, reviewReasons: [] },
  };
}

describe("park duplicate detection", () => {
  it("flags Fårup Sommerland / Fårup Sommarland as HIGH confidence", () => {
    const parks = [
      makePark("park_wikidata_Q1780539", "Fårup Sommerland", "DK", 57.3167, 9.2333),
      makePark("park_wikidata_Q9999999", "Fårup Sommarland", "DK", 57.3169, 9.2335),
    ];

    const candidates = findParkDuplicateCandidates(parks);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]?.confidence).toBe("HIGH");
    expect(candidates[0]?.reasons.some((r) => r.includes("Similar name"))).toBe(true);
  });

  it("does not flag adjacent distinct parks as duplicates", () => {
    const parks = [
      makePark("park_wikidata_Q1", "Universal's Islands of Adventure", "US", 28.4711, -81.4675),
      makePark("park_wikidata_Q2", "Universal Studios Florida", "US", 28.4743, -81.4664),
    ];
    expect(findParkDuplicateCandidates(parks)).toEqual([]);
  });
});
