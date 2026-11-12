import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { CanonicalCoaster } from "../canonical/coaster.js";
import type { CanonicalPark } from "../canonical/park.js";
import { isPlaceholderParkName } from "../matching/parks.js";
import { validateCatalog } from "../validate/rules.js";
import {
  defaultCatalogHiddenRules,
  filterCatalogHiddenRows,
  hiddenCoasterReason,
  isCatalogHiddenParkName,
  loadCatalogHiddenRules,
  type CatalogHiddenRules,
} from "./catalog-hidden.js";

const PROV = [{ source: "test", retrievedAt: "2026-01-01T00:00:00.000Z" }];

function makePark(id: string, name: string): CanonicalPark {
  return {
    id,
    sourceIds: {},
    name: { value: name, provenance: PROV },
    aliases: [],
    countryCode: { value: "US", provenance: PROV },
    status: "OPERATING",
    coordinates: { value: { lat: 40, lng: -75 }, provenance: PROV },
    website: null,
    verification: { needsReview: false, reviewReasons: [] },
  };
}

function makeCoaster(
  dbId: number,
  name: string,
  parkId: string | null,
  opts: { wikidata?: string; manufacturer?: string; stats?: [number, number, number] } = {},
): CanonicalCoaster {
  const [heightM, speedMs, lengthM] = opts.stats ?? [20, 20, 400];
  const sourceIds: CanonicalCoaster["sourceIds"] = { coastertrak: String(dbId) };
  if (opts.wikidata) sourceIds.wikidata = opts.wikidata;
  return {
    id: opts.wikidata ? `coaster_wikidata_${opts.wikidata}` : `coaster_db_${dbId}`,
    sourceIds,
    name: { value: name, provenance: PROV },
    aliases: [],
    parkId,
    countryCode: { value: "US", provenance: PROV },
    manufacturer: { value: opts.manufacturer ?? "Vekoma", provenance: PROV },
    model: null,
    coasterType: null,
    status: "OPERATING",
    openingDate: { value: "2000", provenance: PROV },
    closingDate: null,
    height: { value: { value: heightM, unit: "m" }, provenance: PROV },
    speed: { value: { value: speedMs, unit: "m/s" }, provenance: PROV },
    length: { value: { value: lengthM, unit: "m" }, provenance: PROV },
    inversions: null,
    duration: null,
    coordinates: null,
    description: null,
    imageUrl: { value: "https://example.com/a.jpg", provenance: PROV },
    verification: { needsReview: false, reviewReasons: [] },
  };
}

const rules = defaultCatalogHiddenRules();

describe("committed catalog-hidden-rules.json", () => {
  it("parses and carries the rules CoasterTrak hides rows with", () => {
    expect(rules.skipWikidataCoasterIds).toContain("Q3569870");
    expect(rules.misattributedRows["Lake Compounce"]).toContain("Recoil");
    expect(rules.misattributedRows["Dreamland Margate"]).toContain("The Great Scenic Railway");
    expect(rules.misattributedRows["Six Flags America"]).toContain(
      "Flashback (Six Flags New England)",
    );
    expect(rules.placeholderParkNames).toContain("other");
  });

  it("has a park-name check that agrees with CoasterTrak on every example", () => {
    expect(rules.hiddenParkNameExamples.length).toBeGreaterThan(10);
    for (const { name, hidden } of rules.hiddenParkNameExamples) {
      expect(isCatalogHiddenParkName(name, rules), JSON.stringify(name)).toBe(hidden);
      expect(isPlaceholderParkName(name), JSON.stringify(name)).toBe(hidden);
    }
  });
});

describe("loadCatalogHiddenRules", () => {
  it("rejects a file that does not match the schema", () => {
    const dir = mkdtempSync(join(tmpdir(), "hidden-rules-"));
    const path = join(dir, "rules.json");
    writeFileSync(path, JSON.stringify({ version: 1, skipWikidataCoasterIds: "Q1" }));
    expect(() => loadCatalogHiddenRules(path)).toThrow(/Invalid catalog hidden-row rules/);
  });
});

describe("hiddenCoasterReason", () => {
  const custom: CatalogHiddenRules = {
    version: 1,
    skipWikidataCoasterIds: ["Q100"],
    misattributedRows: { "Park A": ["Wrong Ride"] },
    nonCoasterRows: { "Park A": ["Ferris Wheel"] },
    placeholderParkNames: ["other"],
    hiddenParkNameExamples: [],
  };
  const parkA = makePark("p_a", "Park A");

  it("names each reason", () => {
    expect(
      hiddenCoasterReason(makeCoaster(1, "X", "p_a", { wikidata: "q100" }), parkA, custom),
    ).toBe("skipped_wikidata_id");
    expect(hiddenCoasterReason(makeCoaster(2, "X", "p_o"), makePark("p_o", "Other"), custom)).toBe(
      "placeholder_park",
    );
    expect(hiddenCoasterReason(makeCoaster(3, "Wrong Ride", "p_a"), parkA, custom)).toBe(
      "misattributed_row",
    );
    expect(hiddenCoasterReason(makeCoaster(4, "Ferris Wheel", "p_a"), parkA, custom)).toBe(
      "not_a_coaster",
    );
  });

  it("matches rows only at the park they are listed under", () => {
    expect(
      hiddenCoasterReason(makeCoaster(5, "Wrong Ride", "p_b"), makePark("p_b", "Park B"), custom),
    ).toBeNull();
  });

  it("keeps a coaster with no park so the missing link is still reported", () => {
    expect(hiddenCoasterReason(makeCoaster(6, "Orphan", null), null, custom)).toBeNull();
  });
});

describe("filterCatalogHiddenRows with the four rows the site hides", () => {
  // Coaster ids 522, 31, 15794 and 441 and the rows the duplicate check paired them with.
  const parks = [
    makePark("park_db_177", "Universal Studios Florida"),
    makePark("park_db_20", "Dreamland Margate"),
    makePark("park_wikidata_Q1749186", "Six Flags America"),
    makePark("park_wikidata_Q3216454", "Lake Compounce"),
    makePark("park_db_8", "Other"),
  ];
  const coasters = [
    makeCoaster(522, "Woody Woodpecker's Nuthouse Coaster", "park_db_177", {
      wikidata: "Q3569870",
      stats: [9, 10, 0],
    }),
    makeCoaster(9797, "Trolls Trollercoaster", "park_db_177", { stats: [9, 10, 0] }),
    makeCoaster(31, "The Great Scenic Railway", "park_db_20", { stats: [10, 15, 900] }),
    makeCoaster(2229130, "Scenic Railway", "park_db_20", {
      wikidata: "Q2229130",
      stats: [10, 15, 900],
    }),
    makeCoaster(15794, "Flashback (Six Flags New England)", "park_wikidata_Q1749186", {
      stats: [35, 21, 285],
    }),
    makeCoaster(15768, "Firebird Boomerang", "park_wikidata_Q1749186", { stats: [35, 21, 285] }),
    makeCoaster(441, "Recoil", "park_wikidata_Q3216454", {
      wikidata: "Q8074180",
      stats: [35, 21, 286],
    }),
    makeCoaster(443, "Zoomerang", "park_wikidata_Q3216454", {
      wikidata: "Q8074183",
      stats: [35, 21, 286],
    }),
    makeCoaster(900, "Mystery Ride", "park_db_8"),
  ];
  const targetIds = new Set([
    "coaster_wikidata_Q3569870",
    "coaster_db_31",
    "coaster_db_15794",
    "coaster_wikidata_Q8074180",
  ]);

  function itemIds(items: ReturnType<typeof validateCatalog>["reviewItems"]): string[] {
    return items.flatMap((item) =>
      "entityA" in item ? [item.entityA, item.entityB] : [item.entityId],
    );
  }

  it("hides exactly those rows plus the placeholder park and its ride", () => {
    const result = filterCatalogHiddenRows(parks, coasters, rules);
    expect(result.hiddenCoasters.map((c) => [c.dbId, c.reason])).toEqual([
      [522, "skipped_wikidata_id"],
      [31, "misattributed_row"],
      [15794, "misattributed_row"],
      [441, "misattributed_row"],
      [900, "placeholder_park"],
    ]);
    expect(result.hiddenParks).toEqual([{ id: "park_db_8", name: "Other" }]);
    expect(result.coasters.map((c) => c.sourceIds.coastertrak)).toEqual([
      "9797",
      "2229130",
      "15768",
      "443",
    ]);
  });

  it("raises duplicate pairs for them only when the filter is skipped", () => {
    const raw = validateCatalog({ parks, coasters, sourceRunId: "t" });
    const rawIds = itemIds(raw.reviewItems);
    for (const id of targetIds) expect(rawIds, id).toContain(id);

    const visible = filterCatalogHiddenRows(parks, coasters, rules);
    const filtered = validateCatalog({
      parks: visible.parks,
      coasters: visible.coasters,
      sourceRunId: "t",
    });
    const filteredIds = itemIds(filtered.reviewItems);
    for (const id of targetIds) expect(filteredIds, id).not.toContain(id);
    expect(filteredIds).not.toContain("coaster_db_900");
  });
});
