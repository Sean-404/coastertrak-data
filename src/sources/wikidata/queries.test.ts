import { describe, expect, it } from "vitest";

import { COASTER_QUERIES, PARK_QUERIES, buildPaginatedQuery } from "./queries.js";

describe("wikidata queries", () => {
  it("includes roller coaster class hierarchy for coasters", () => {
    expect(COASTER_QUERIES.full).toContain("wd:Q204832");
    expect(COASTER_QUERIES.full).toContain("P2048");
    expect(COASTER_QUERIES.full).toContain("P2052");
  });

  it("includes theme and amusement park classes for parks", () => {
    expect(PARK_QUERIES.full).toContain("wd:Q2416723");
    expect(PARK_QUERIES.full).toContain("wd:Q3363942");
    expect(PARK_QUERIES.full).toContain("Q875912");
  });

  it("builds paginated queries with LIMIT and OFFSET", () => {
    const query = buildPaginatedQuery(COASTER_QUERIES.lite, 200, 50);
    expect(query).toContain("LIMIT 50");
    expect(query).toContain("OFFSET 200");
  });
});
