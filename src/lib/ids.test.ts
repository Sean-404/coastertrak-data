import { describe, expect, it } from "vitest";

import { coasterIdFromSource, parseWikidataQid, parkIdFromSource } from "./ids.js";

describe("ids", () => {
  it("generates deterministic park IDs from Wikidata QIDs", () => {
    expect(parkIdFromSource("wikidata", "Q789078")).toBe("park_wikidata_Q789078");
    expect(parkIdFromSource("wikidata", "q789078")).toBe("park_wikidata_Q789078");
  });

  it("generates deterministic coaster IDs from Wikidata QIDs", () => {
    expect(coasterIdFromSource("wikidata", "Q1234567")).toBe("coaster_wikidata_Q1234567");
  });

  it("parses QIDs from URIs and direct strings", () => {
    expect(parseWikidataQid("http://www.wikidata.org/entity/Q789078")).toBe("Q789078");
    expect(parseWikidataQid("Q789078")).toBe("Q789078");
    expect(parseWikidataQid("invalid")).toBeNull();
  });
});
