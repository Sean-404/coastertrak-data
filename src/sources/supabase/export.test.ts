import { describe, expect, it } from "vitest";

import { mapSupabaseCoaster, mapSupabasePark, UNKNOWN_COUNTRY_CODE } from "./export.js";

describe("supabase export mapping", () => {
  it("maps park rows to canonical entities with ISO country", () => {
    const park = mapSupabasePark(
      {
        id: 1,
        name: "Universal Studios Singapore",
        country: "Singapore",
        latitude: 1.254,
        longitude: 103.824,
        external_source: "wikidata",
        external_id: "Q789078",
        last_synced_at: null,
      },
      "2026-01-01T00:00:00.000Z",
    );
    expect(park.countryCode.value).toBe("SG");
    expect(park.id).toBe("park_wikidata_Q789078");
    expect(park.verification.needsReview).toBe(false);
  });

  it("keeps parks with unmapped country using ZZ and needsReview", () => {
    const park = mapSupabasePark(
      {
        id: 2,
        name: "Mystery Park",
        country: "Atlantis Continent",
        latitude: 0,
        longitude: 0,
        external_source: null,
        external_id: null,
        last_synced_at: null,
      },
      "2026-01-01T00:00:00.000Z",
    );
    expect(park.id).toBe("park_db_2");
    expect(park.countryCode.value).toBe(UNKNOWN_COUNTRY_CODE);
    expect(park.verification.needsReview).toBe(true);
    expect(park.verification.reviewReasons[0]).toMatch(/Unmapped park country/);
  });

  it("does not mark Operating coasters as REMOVED just because closing_year is set", () => {
    const coaster = mapSupabaseCoaster(
      {
        id: 11,
        park_id: 1,
        name: "Still Running",
        coaster_type: "Steel",
        manufacturer: null,
        status: "Operating",
        external_source: null,
        external_id: null,
        wikidata_id: null,
        height_ft: null,
        speed_mph: null,
        length_ft: null,
        inversions: null,
        duration_s: null,
        opening_year: 2000,
        closing_year: 2099,
        enwiki_title: null,
        summary_text: null,
        image_url: null,
        last_synced_at: null,
      },
      new Map([[1, "park_db_1"]]),
      "2026-01-01T00:00:00.000Z",
    );
    expect(coaster.status).toBe("OPERATING");
  });

  it("converts imperial coaster stats to metric", () => {
    const coaster = mapSupabaseCoaster(
      {
        id: 10,
        park_id: 1,
        name: "Test Coaster",
        coaster_type: "Steel",
        manufacturer: "Vekoma",
        status: "Operating",
        external_source: "wikidata",
        external_id: "Q123",
        wikidata_id: "Q123",
        height_ft: 140,
        speed_mph: 50,
        length_ft: 3000,
        inversions: 3,
        duration_s: 120,
        opening_year: 2010,
        closing_year: null,
        enwiki_title: null,
        summary_text: null,
        image_url: null,
        last_synced_at: null,
      },
      new Map([[1, "park_wikidata_Q789078"]]),
      "2026-01-01T00:00:00.000Z",
    );
    expect(coaster.height?.value.unit).toBe("m");
    expect(coaster.speed?.value.unit).toBe("m/s");
    expect(coaster.parkId).toBe("park_wikidata_Q789078");
  });
});
