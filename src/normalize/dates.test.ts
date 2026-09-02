import { describe, expect, it } from "vitest";

import {
  isClosingBeforeOpening,
  parseWikidataDate,
} from "./dates.js";
import { inferCoasterStatus } from "./status.js";

describe("dates and status", () => {
  it("parses Wikidata datetime values", () => {
    expect(parseWikidataDate("+2010-03-18T00:00:00Z")).toBe("2010-03-18");
    expect(parseWikidataDate("+2000-00-00T00:00:00Z")).toBe("2000");
  });

  it("detects closing before opening", () => {
    expect(isClosingBeforeOpening("2010-01-01", "2009-01-01")).toBe(true);
    expect(isClosingBeforeOpening("2010-01-01", "2012-01-01")).toBe(false);
  });

  it("maps demolished coasters to REMOVED", () => {
    expect(
      inferCoasterStatus({
        opening: "+2000-05-05T00:00:00Z",
        demolished: "+2012-11-20T00:00:00Z",
      }),
    ).toBe("REMOVED");
  });
});
