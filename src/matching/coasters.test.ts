import { describe, expect, it } from "vitest";

import type { CanonicalCoaster } from "../canonical/coaster.js";
import { findCoasterDuplicateCandidates } from "./coasters.js";

function makeCoaster(
  id: string,
  name: string,
  parkId: string | null,
  wikidata?: string,
): CanonicalCoaster {
  const prov = [{ source: "test", retrievedAt: "2026-01-01T00:00:00.000Z" }];
  return {
    id,
    sourceIds: wikidata ? { wikidata } : {},
    name: { value: name, provenance: prov },
    aliases: [],
    parkId,
    countryCode: null,
    manufacturer: null,
    model: null,
    coasterType: null,
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
}

describe("coaster duplicate detection", () => {
  it("flags same-park similar names", () => {
    const coasters = [
      makeCoaster("a", "The Joker", "park_a", "Q1"),
      makeCoaster("b", "The Joker", "park_a", "Q2"),
    ];
    const candidates = findCoasterDuplicateCandidates(coasters, new Map());
    expect(candidates.length).toBeGreaterThan(0);
  });

  it("ignores cross-park generic name matches like The Joker", () => {
    const coasters = [
      makeCoaster("a", "The Joker", "park_a", "Q1"),
      makeCoaster("b", "The Joker", "park_b", "Q2"),
    ];
    const candidates = findCoasterDuplicateCandidates(coasters, new Map());
    expect(candidates.length).toBe(0);
  });

  it("does not flag clone hardware at different parks as duplicates", () => {
    const prov = [{ source: "test", retrievedAt: "2026-01-01T00:00:00.000Z" }];
    const a = makeCoaster("a", "Little Dipper", "park_a", "Q1");
    const b = makeCoaster("b", "Little Dipper", "park_b", "Q2");
    a.manufacturer = { value: "Allan Herschell Company", provenance: prov };
    b.manufacturer = { value: "Allan Herschell Company", provenance: prov };
    a.openingDate = { value: "1952", provenance: prov };
    b.openingDate = { value: "1952", provenance: prov };
    expect(findCoasterDuplicateCandidates([a, b], new Map())).toEqual([]);
  });
});
