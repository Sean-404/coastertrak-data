import { describe, expect, it } from "vitest";

import type { CanonicalPark } from "../canonical/park.js";
import { applyParkOverrides } from "./apply.js";
import type { ParkOverrideEntry } from "./types.js";

describe("override application", () => {
  it("applies country override with manual provenance", () => {
    const park: CanonicalPark = {
      id: "park_wikidata_Q789078",
      sourceIds: { wikidata: "Q789078" },
      name: {
        value: "Universal Studios Singapore",
        provenance: [{ source: "wikidata", sourceId: "Q789078", retrievedAt: "2026-01-01T00:00:00.000Z" }],
      },
      aliases: [],
      countryCode: {
        value: "MY",
        provenance: [{ source: "wikidata", sourceId: "Q789078", retrievedAt: "2026-01-01T00:00:00.000Z", rawValue: "Malaysia" }],
      },
      status: "OPERATING",
      coordinates: {
        value: { lat: 1.254, lng: 103.824 },
        provenance: [{ source: "wikidata", sourceId: "Q789078", retrievedAt: "2026-01-01T00:00:00.000Z" }],
      },
      website: null,
      verification: { needsReview: false, reviewReasons: [] },
    };

    const overrides: ParkOverrideEntry[] = [
      {
        match: { "sourceIds.wikidata": "Q789078" },
        patch: { countryCode: "SG" },
        reason: "Wikidata P17 incorrectly lists Malaysia",
        appliedBy: "manual",
        appliedAt: "2026-08-28T00:00:00.000Z",
      },
    ];

    const [updated] = applyParkOverrides([park], overrides);
    expect(updated!.countryCode.value).toBe("SG");
    expect(updated!.countryCode.provenance.some((p) => p.source === "manual")).toBe(true);
  });
});
