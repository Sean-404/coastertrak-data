import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  canonicalCoasterListSchema,
  canonicalParkListSchema,
} from "../src/canonical/index.js";
import { fixturesDir } from "../src/lib/paths.js";

describe("canonical fixtures", () => {
  it("parses all canonical fixture files", async () => {
    const canonicalDir = join(fixturesDir(), "canonical");
    const files = (await readdir(canonicalDir)).filter((f) => f.endsWith(".json"));

    for (const file of files) {
      const raw = JSON.parse(await readFile(join(canonicalDir, file), "utf8"));
      if (file.includes("park")) {
        expect(canonicalParkListSchema.safeParse(raw).success).toBe(true);
      } else if (file.includes("coaster")) {
        expect(canonicalCoasterListSchema.safeParse(raw).success).toBe(true);
      }
    }
  });
});
