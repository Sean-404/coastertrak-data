import { describe, expect, it } from "vitest";

import { aiReviewBatchResponseSchema } from "./types.js";

describe("aiReviewBatchResponseSchema", () => {
  it("parses a valid batch response", () => {
    const parsed = aiReviewBatchResponseSchema.parse({
      assessments: [
        {
          itemKey: "missing_data:coaster_1",
          plausible: false,
          confidence: "HIGH",
          issue: "Coaster country ZA but park is in Japan",
          suggestedAction: "Relink to Gold Reef City",
        },
      ],
    });
    expect(parsed.assessments).toHaveLength(1);
  });
});
