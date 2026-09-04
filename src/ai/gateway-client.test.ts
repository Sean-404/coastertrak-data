import { describe, expect, it } from "vitest";

import { extractJsonObject, salvageAssessmentsJson } from "./gateway-client.js";

describe("salvageAssessmentsJson", () => {
  it("recovers complete assessments from truncated JSON", () => {
    const truncated = `{
  "assessments": [
    {
      "itemKey": "missing_data:coaster_db_1",
      "plausible": true,
      "confidence": "HIGH",
      "issue": "Stats missing but linkage looks fine"
    },
    {
      "itemKey": "missing_data:coaster_db_2",
      "plausible": true,
      "confidence": "HIGH",
      "issue": "Key stats (height, speed, length, manufacturer, openin`;

    const salvaged = salvageAssessmentsJson(truncated);
    expect(salvaged?.assessments).toHaveLength(1);
    expect(salvaged?.assessments[0]).toMatchObject({
      itemKey: "missing_data:coaster_db_1",
      plausible: true,
    });
  });

  it("is used by extractJsonObject for truncated payloads", () => {
    const truncated =
      '{"assessments":[{"itemKey":"a","plausible":false,"confidence":"LOW","issue":"ok"},{"itemKey":"b","plausible":true,"confidence":"HIGH","issue":"cut off mid';
    const parsed = extractJsonObject(truncated) as { assessments: unknown[] };
    expect(parsed.assessments).toHaveLength(1);
  });
});
