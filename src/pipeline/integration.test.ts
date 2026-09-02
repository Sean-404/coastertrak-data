import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { ingestWikidata } from "../sources/wikidata/ingest.js";
import { processRawRun } from "./process.js";
import { exportCatalog, validateProcessedRun } from "./run.js";

describe("pipeline integration", () => {
  it("runs ingest → process → validate → export on fixtures", async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), "coastertrak-data-"));

    try {
      await cp(join(process.cwd(), "data", "overrides"), join(dataRoot, "overrides"), {
        recursive: true,
      });

      const ingest = await ingestWikidata({ dataRoot, fixture: true });
      expect(ingest.meta.pageCount).toBeGreaterThan(0);

      const processed = await processRawRun({ dataRoot, sourceRunId: ingest.meta.runId });
      expect(processed.parkCount).toBe(3);
      expect(processed.coasterCount).toBe(4);

      const uss = JSON.parse(
        await readFile(join(processed.runDir, "parks.json"), "utf8"),
      ) as { parks: Array<{ sourceIds: { wikidata: string }; countryCode: { value: string } }> };
      const singaporePark = uss.parks.find((p) => p.sourceIds.wikidata === "Q789078");
      expect(singaporePark?.countryCode.value).toBe("SG");

      const validation = await validateProcessedRun({
        dataRoot,
        sourceRunId: ingest.meta.runId,
      });
      expect(validation.report.summary.parks).toBe(3);

      const outDir = await exportCatalog({ dataRoot, sourceRunId: ingest.meta.runId });
      const exportMeta = JSON.parse(await readFile(join(outDir, "meta.json"), "utf8")) as {
        coasterCount: number;
      };
      expect(exportMeta.coasterCount).toBe(4);
    } finally {
      await rm(dataRoot, { recursive: true, force: true });
    }
  }, 30_000);
});
