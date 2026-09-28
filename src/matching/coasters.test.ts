import { describe, expect, it } from "vitest";

import type { CanonicalCoaster } from "../canonical/coaster.js";
import { findCoasterDuplicateCandidates } from "./coasters.js";

const PROV = [{ source: "test", retrievedAt: "2026-01-01T00:00:00.000Z" }];

function makeCoaster(
  id: string,
  name: string,
  parkId: string | null,
  wikidata?: string,
): CanonicalCoaster {
  return {
    id,
    sourceIds: wikidata ? { wikidata } : {},
    name: { value: name, provenance: PROV },
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

function withMfr(coaster: CanonicalCoaster, manufacturer: string, type?: string): CanonicalCoaster {
  return {
    ...coaster,
    manufacturer: { value: manufacturer, provenance: PROV },
    coasterType: type ? { value: type, provenance: PROV } : coaster.coasterType,
  };
}

function withScale(
  coaster: CanonicalCoaster,
  heightM: number | null,
  lengthM: number | null,
): CanonicalCoaster {
  return {
    ...coaster,
    height:
      heightM == null
        ? null
        : { value: { value: heightM, unit: "m" }, provenance: PROV, confidence: "HIGH" },
    length:
      lengthM == null
        ? null
        : { value: { value: lengthM, unit: "m" }, provenance: PROV, confidence: "HIGH" },
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
    const a = withMfr(makeCoaster("a", "Little Dipper", "park_a", "Q1"), "Allan Herschell Company");
    const b = withMfr(makeCoaster("b", "Little Dipper", "park_b", "Q2"), "Allan Herschell Company");
    a.openingDate = { value: "1952", provenance: PROV };
    b.openingDate = { value: "1952", provenance: PROV };
    expect(findCoasterDuplicateCandidates([a, b], new Map())).toEqual([]);
  });

  it("does not flag Mild Thing / Wild Thing as duplicates", () => {
    const mild = withMfr(
      makeCoaster("mild", "Mild Thing", "valleyfair", "Q6850884"),
      "Allan Herschell Company",
      "Steel",
    );
    const wild = withScale(
      withMfr(makeCoaster("wild", "Wild Thing", "valleyfair", "Q1714470"), "D. H. Morgan Manufacturing", "Steel"),
      63,
      1664,
    );
    expect(findCoasterDuplicateCandidates([mild, wild], new Map())).toEqual([]);
  });

  it("does not flag The Beast / The Beastie as duplicates", () => {
    const beast = withScale(
      withMfr(makeCoaster("beast", "The Beast", "ki", "Q664237"), "Kings Island", "Wood"),
      34,
      2243,
    );
    const beastie = withScale(
      withMfr(makeCoaster("beastie", "The Beastie", "ki"), "Philadelphia Toboggan Coasters", "Wood"),
      12,
      411,
    );
    expect(findCoasterDuplicateCandidates([beast, beastie], new Map())).toEqual([]);
  });

  it("does not flag Ravine Flyer 3 / Ravine Flyer II as duplicates", () => {
    const flyer3 = withMfr(
      makeCoaster("rf3", "Ravine Flyer 3", "waldameer", "Q7296753"),
      "E&F Miler Industries",
      "Steel",
    );
    const flyer2 = withScale(
      withMfr(
        makeCoaster("rf2", "Ravine Flyer II", "waldameer", "Q2133717"),
        "The Gravity Group",
        "Wood",
      ),
      26,
      933,
    );
    expect(findCoasterDuplicateCandidates([flyer3, flyer2], new Map())).toEqual([]);
  });

  it("still flags same-park exact-name twins with different manufacturers", () => {
    const a = withMfr(makeCoaster("a", "The Joker", "park_a", "Q1"), "S&S");
    const b = withMfr(makeCoaster("b", "The Joker", "park_a", "Q2"), "RMC");
    expect(findCoasterDuplicateCandidates([a, b], new Map()).length).toBeGreaterThan(0);
  });
});
