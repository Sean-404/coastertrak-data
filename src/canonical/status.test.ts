import { describe, expect, it } from "vitest";

import {
  coasterStatusSchema,
  parkStatusSchema,
  toCoasterTrakCoasterStatus,
  toCoasterTrakParkStatus,
} from "./status.js";

describe("status mapping", () => {
  it("parses canonical coaster statuses", () => {
    expect(coasterStatusSchema.parse("OPERATING")).toBe("OPERATING");
    expect(coasterStatusSchema.parse("REMOVED")).toBe("REMOVED");
  });

  it("maps to CoasterTrak legacy labels", () => {
    expect(toCoasterTrakCoasterStatus("OPERATING")).toBe("Operating");
    expect(toCoasterTrakCoasterStatus("REMOVED")).toBe("Defunct");
    expect(toCoasterTrakCoasterStatus("UNDER_CONSTRUCTION")).toBe("Unknown");
    expect(toCoasterTrakParkStatus("CLOSED")).toBe("Defunct");
  });

  it("rejects invalid status values", () => {
    expect(() => coasterStatusSchema.parse("OPEN")).toThrow();
    expect(() => parkStatusSchema.parse("REMOVED")).toThrow();
  });
});
