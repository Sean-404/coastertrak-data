import { describe, expect, it } from "vitest";

import { mapSupabaseCoaster, mapSupabasePark } from "./export.js";

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
    expect(park?.countryCode.value).toBe("SG");
    expect(park?.id).toBe("park_wikidata_Q789078");
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
