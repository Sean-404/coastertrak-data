import { describe, expect, it } from "vitest";

import { normalizeNameForMatch } from "./name.js";

describe("name normalisation", () => {
  it("normalises Fårup Sommerland variants similarly", () => {
    const a = normalizeNameForMatch("Fårup Sommerland");
    const b = normalizeNameForMatch("Fårup Sommarland");
    expect(a).not.toBe(b);
    expect(a.slice(0, 5)).toBe(b.slice(0, 5));
  });

  it("strips theme park suffix noise", () => {
    expect(normalizeNameForMatch("Six Flags Theme Park")).toContain("six flags");
    expect(normalizeNameForMatch("Six Flags Theme Park")).not.toContain("theme park");
  });
});
