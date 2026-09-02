import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { fixturesDir } from "../../lib/paths.js";
import { mapWikidataRaw } from "./mapper.js";
import type { WikidataRawRunMeta, WikidataSparqlPage } from "./types.js";

async function loadFixturePage(entity: "coasters" | "parks"): Promise<WikidataSparqlPage> {
  return JSON.parse(
    await readFile(join(fixturesDir(), "wikidata", "raw-pages", entity, "000000.json"), "utf8"),
  ) as WikidataSparqlPage;
}

describe("wikidata mapper", () => {
  it("maps fixture pages to canonical entities", async () => {
    const meta: WikidataRawRunMeta = {
      generatedAt: "2026-09-02T14:00:00.000Z",
      source: "wikidata",
      runId: "test",
      endpoint: "https://query.wikidata.org/sparql",
      mode: "fixture",
      options: {},
    };

    const result = mapWikidataRaw({
      meta,
      coasterPages: [await loadFixturePage("coasters")],
      parkPages: [await loadFixturePage("parks")],
    });

    expect(result.parks.length).toBe(3);
    expect(result.coasters.length).toBe(4);
    expect(result.parks.some((p) => p.sourceIds.wikidata === "Q789078")).toBe(true);
    expect(result.coasters.some((c) => c.name.value.includes("Battlestar"))).toBe(true);
    expect(result.coasters.some((c) => c.status === "REMOVED")).toBe(true);
  });
});
