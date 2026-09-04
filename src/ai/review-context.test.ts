import { describe, expect, it } from "vitest";

import type { CanonicalCoaster } from "../canonical/coaster.js";
import type { CanonicalPark } from "../canonical/park.js";
import { buildReviewItemContext, selectItemsForAiReview } from "./review-context.js";
import type { ReviewItem } from "../matching/types.js";

describe("selectItemsForAiReview", () => {
  const items: ReviewItem[] = [
    {
      type: "POSSIBLE_DUPLICATE",
      entityType: "coaster",
      entityA: "a",
      entityB: "b",
      nameA: "Joker",
      nameB: "Joker",
      confidence: "LOW",
      reasons: [],
      action: "REVIEW",
    },
    {
      type: "MISSING_DATA",
      entityType: "coaster",
      entityId: "c1",
      entityName: "Cyclone",
      field: "parkId",
      reason: "missing park",
      action: "REVIEW",
    },
    {
      type: "SUSPICIOUS_VALUE",
      entityType: "coaster",
      entityId: "c2",
      entityName: "Huge",
      field: "height",
      value: 999,
      reason: "too tall",
      confidence: "MEDIUM",
      action: "REVIEW",
    },
  ];

  it("skips duplicates and missing-data by default; prioritizes suspicious values", () => {
    const selected = selectItemsForAiReview(items, 10, false);
    expect(selected.map((i) => i.type)).toEqual(["SUSPICIOUS_VALUE"]);
  });

  it("can include missing-data when requested", () => {
    const selected = selectItemsForAiReview(items, 10, false, true);
    expect(selected.map((i) => i.type)).toEqual(["SUSPICIOUS_VALUE", "MISSING_DATA"]);
  });

  it("respects limit", () => {
    const selected = selectItemsForAiReview(items, 1, true, true);
    expect(selected).toHaveLength(1);
    expect(selected[0]?.type).toBe("SUSPICIOUS_VALUE");
  });
});

describe("buildReviewItemContext", () => {
  it("includes linked park for coasters", () => {
    const prov = [{ source: "test", retrievedAt: "2026-01-01T00:00:00.000Z" }];
    const park: CanonicalPark = {
      id: "park_1",
      sourceIds: {},
      name: { value: "Gold Reef City", provenance: prov },
      aliases: [],
      countryCode: { value: "ZA", provenance: prov },
      status: "OPERATING",
      coordinates: { value: { lat: -26.2, lng: 28.0 }, provenance: prov },
      website: null,
      verification: { needsReview: false, reviewReasons: [] },
    };
    const coaster: CanonicalCoaster = {
      id: "coaster_1",
      sourceIds: { wikidata: "Q1" },
      name: { value: "Tower of Terror", provenance: prov },
      aliases: [],
      parkId: "park_1",
      countryCode: { value: "ZA", provenance: prov },
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

    const ctx = buildReviewItemContext(
      {
        type: "MISSING_DATA",
        entityType: "coaster",
        entityId: "coaster_1",
        entityName: "Tower of Terror",
        field: "parkId",
        reason: "missing park linkage",
        action: "REVIEW",
      },
      0,
      new Map([["park_1", park]]),
      new Map([["coaster_1", coaster]]),
    );

    expect(ctx.related?.linkedPark).toMatchObject({ name: "Gold Reef City", country: "ZA" });
  });
});
