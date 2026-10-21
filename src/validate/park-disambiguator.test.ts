import { describe, expect, it } from "vitest";

import { mismatchedParkDisambiguator, trailingDisambiguator } from "./park-disambiguator.js";

describe("trailingDisambiguator", () => {
  it("reads the trailing parenthetical", () => {
    expect(trailingDisambiguator("Wildcat (Jolly Roger Amusement Park)")).toBe("Jolly Roger Amusement Park");
    expect(trailingDisambiguator("Nemesis")).toBeNull();
  });
});

describe("mismatchedParkDisambiguator", () => {
  it("flags a disambiguator naming a different park (live Cedar Point cases)", () => {
    expect(mismatchedParkDisambiguator("Wildcat (Jolly Roger Amusement Park)", ["Cedar Point"])).toBe(
      "Jolly Roger Amusement Park",
    );
    expect(mismatchedParkDisambiguator("Jumbo Jet (Chelyuskintsev Park)", ["Cedar Point"])).toBe(
      "Chelyuskintsev Park",
    );
  });

  it("accepts a disambiguator that names the linked park", () => {
    expect(
      mismatchedParkDisambiguator("Batman: The Ride (Six Flags Great Adventure)", [
        "Six Flags Great Adventure",
      ]),
    ).toBeNull();
    expect(mismatchedParkDisambiguator("Big One (Blackpool)", ["Blackpool Pleasure Beach"])).toBeNull();
  });

  it("matches against park aliases", () => {
    expect(mismatchedParkDisambiguator("Thunder Run (Kennywood)", ["Kennywood Park", "Kennywood"])).toBeNull();
  });

  it("ignores generic or year disambiguators", () => {
    expect(mismatchedParkDisambiguator("Abyss (roller coaster)", ["Adventure World"])).toBeNull();
    expect(mismatchedParkDisambiguator("Blue Streak (1964)", ["Cedar Point"])).toBeNull();
    expect(mismatchedParkDisambiguator("Comet (wooden coaster)", ["Hersheypark"])).toBeNull();
  });

  it("does not match on weak shared words like 'Six Flags'", () => {
    expect(
      mismatchedParkDisambiguator("Batman: The Ride (Six Flags Over Georgia)", ["Six Flags Great Adventure"]),
    ).toBe("Six Flags Over Georgia");
  });
});
