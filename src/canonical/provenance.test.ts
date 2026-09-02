import { describe, expect, it } from "vitest";
import { z } from "zod";

import { sourcedValueSchema } from "./provenance.js";

describe("provenance schemas", () => {
  it("requires at least one provenance record on sourced values", () => {
    const schema = sourcedValueSchema(z.string());
    expect(() => schema.parse({ value: "x", provenance: [] })).toThrow();
  });

  it("accepts valid provenance with optional rawValue", () => {
    const schema = sourcedValueSchema(z.string());
    const parsed = schema.parse({
      value: "test",
      provenance: [
        {
          source: "wikidata",
          sourceId: "Q123",
          retrievedAt: "2026-01-01T00:00:00.000Z",
          rawValue: "original label",
        },
      ],
      confidence: "HIGH",
    });
    expect(parsed.provenance[0]?.rawValue).toBe("original label");
  });
});
