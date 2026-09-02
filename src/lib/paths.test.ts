import { describe, expect, it } from "vitest";
import { normalize } from "node:path";

import {
  formatPageFileName,
  newRunId,
  wikidataFixturePagesDir,
  wikidataRawRunDir,
} from "./paths.js";

describe("paths", () => {
  it("generates filesystem-safe run IDs", () => {
    const id = newRunId(new Date("2026-09-02T14:00:00.000Z"));
    expect(id).toBe("2026-09-02T14-00-00-000Z");
    expect(id).not.toContain(":");
  });

  it("builds wikidata raw run directory paths", () => {
    expect(normalize(wikidataRawRunDir("2026-09-02T14-00-00-000Z"))).toBe(
      normalize("data/raw/wikidata/2026-09-02T14-00-00-000Z"),
    );
  });

  it("formats page file names with zero padding", () => {
    expect(formatPageFileName(0)).toBe("000000.json");
    expect(formatPageFileName(200)).toBe("000200.json");
  });

  it("resolves fixture page directories", () => {
    expect(normalize(wikidataFixturePagesDir("coasters"))).toContain(
      normalize("fixtures/wikidata/raw-pages/coasters"),
    );
  });
});
