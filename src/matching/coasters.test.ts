import { describe, expect, it } from "vitest";

import type { CanonicalCoaster } from "../canonical/coaster.js";
import { findCoasterDuplicateCandidates, isFormerVersionPair, manufacturerKey } from "./coasters.js";

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

function withWiki(coaster: CanonicalCoaster, enwiki: string): CanonicalCoaster {
  return { ...coaster, sourceIds: { ...coaster.sourceIds, enwiki } };
}

function withYears(coaster: CanonicalCoaster, opened: string | null, closed: string | null): CanonicalCoaster {
  return {
    ...coaster,
    openingDate: opened ? { value: opened, provenance: PROV } : null,
    closingDate: closed ? { value: closed, provenance: PROV } : null,
  };
}

describe("same-ride signals beyond the name", () => {
  it("flags Eurosat / Eurosat - CanCan Coaster, whose names alone score too low", () => {
    const article = "Eurosat - CanCan Coaster";
    const coasters = [
      withWiki(withScale(withMfr(makeCoaster("a", "Eurosat", "europa", "Q874877"), "Mack Rides GmbH & Co KG"), 25.6, 900), article),
      withWiki(withScale(withMfr(makeCoaster("b", article, "europa", "Q63196746"), "Mack Rides"), 25.6, 900), article),
    ];
    const [hit] = findCoasterDuplicateCandidates(coasters, new Map());
    expect(hit).toMatchObject({ entityA: "a", entityB: "b", confidence: "HIGH" });
    expect(hit?.reasons.join(" ")).toContain("Same Wikipedia article");
  });

  it("flags two identical stats as MEDIUM even with unrelated names", () => {
    const coasters = [
      withScale(makeCoaster("a", "Intimidator 305", "kd", "Q1"), 93, 1554),
      withScale(makeCoaster("b", "Pantherian", "kd", "Q2"), 93, 1554),
    ];
    expect(findCoasterDuplicateCandidates(coasters, new Map())[0]?.confidence).toBe("MEDIUM");
  });

  it("does not flag one matching stat", () => {
    const coasters = [
      withScale(makeCoaster("a", "Alpha", "p", "Q1"), 30, 500),
      withScale(makeCoaster("b", "Omega", "p", "Q2"), 30, 900),
    ];
    expect(findCoasterDuplicateCandidates(coasters, new Map())).toEqual([]);
  });

  it("keeps Mantis / Rougarou out: a former version closed before its successor opened", () => {
    const article = "Rougarou (roller coaster)";
    const mantis = withYears(withWiki(withScale(makeCoaster("a", "Mantis", "cp", "Q1"), 44, 1189), article), "1996", "2014");
    const rougarou = withYears(withWiki(withScale(makeCoaster("b", "Rougarou", "cp", "Q2"), 44, 1189), article), "2015", null);
    expect(isFormerVersionPair(mantis, rougarou)).toBe(true);
    expect(findCoasterDuplicateCandidates([mantis, rougarou], new Map())).toEqual([]);
  });

  it("does not skip a closure after the other row opened", () => {
    const a = withYears(makeCoaster("a", "Alpha", "p"), "1990", "2010");
    const b = withYears(makeCoaster("b", "Beta", "p"), "2005", null);
    expect(isFormerVersionPair(a, b)).toBe(false);
  });

  it("rates Comet / Mini-Comet LOW when only the name and manufacturer overlap", () => {
    const coasters = [
      withMfr(makeCoaster("a", "Comet", "hp", "Q1"), "Philadelphia Toboggan Coasters"),
      withMfr(makeCoaster("b", "Mini-Comet", "hp", "Q2"), "Philadelphia Toboggan Coasters"),
    ];
    expect(findCoasterDuplicateCandidates(coasters, new Map())[0]?.confidence).toBe("LOW");
  });

  it("ignores a contained name from a different manufacturer", () => {
    const coasters = [
      withMfr(makeCoaster("a", "Red Force", "fl", "Q1"), "Intamin"),
      withMfr(makeCoaster("b", "Junior Red Force", "fl", "Q2"), "Zamperla"),
    ];
    expect(findCoasterDuplicateCandidates(coasters, new Map())).toEqual([]);
  });

  it("normalises manufacturer suffixes", () => {
    expect(manufacturerKey("Mack Rides GmbH & Co KG")).toBe(manufacturerKey("Mack Rides"));
    expect(manufacturerKey("Vekoma Rides Manufacturing B.V.")).toBe(manufacturerKey("Vekoma"));
    expect(manufacturerKey("Intamin")).not.toBe(manufacturerKey("Mack Rides"));
  });
});

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
