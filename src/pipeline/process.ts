import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { CanonicalCoasterList } from "../canonical/coaster.js";
import type { CanonicalParkList } from "../canonical/park.js";
import { applyQualityScores } from "../confidence/score.js";
import { loadLatestWikidataRawRun, loadWikidataRawRun } from "../lib/load-raw.js";
import { logger } from "../lib/logger.js";
import { processedRunDir } from "../lib/paths.js";
import { applyCoasterOverrides, applyParkOverrides, loadOverrides } from "../overrides/apply.js";
import { mapWikidataRaw } from "../sources/wikidata/mapper.js";
import { validateCatalog } from "../validate/rules.js";

export type ProcessOptions = {
  dataRoot?: string;
  sourceRunId?: string;
  onProgress?: (message: string) => void;
};

export type ProcessResult = {
  runDir: string;
  sourceRunId: string;
  parkCount: number;
  coasterCount: number;
  warnings: string[];
};

export async function processRawRun(options: ProcessOptions = {}): Promise<ProcessResult> {
  const dataRoot = options.dataRoot ?? "data";
  const log = options.onProgress ?? ((msg: string) => logger.info(msg));

  const raw = options.sourceRunId
    ? await loadWikidataRawRun(options.sourceRunId, dataRoot)
    : await loadLatestWikidataRawRun(dataRoot);

  log(`Processing raw run ${raw.runId}…`);

  const mapped = mapWikidataRaw({
    meta: raw.meta,
    coasterPages: raw.coasterPages,
    parkPages: raw.parkPages,
  });

  log(`  mapped ${mapped.parks.length} parks, ${mapped.coasters.length} coasters`);

  const overrides = await loadOverrides(dataRoot);
  let parks = applyParkOverrides(mapped.parks, overrides.parks);
  let coasters = applyCoasterOverrides(mapped.coasters, overrides.coasters);

  if (overrides.parks.length > 0) log(`  applied ${overrides.parks.length} park override(s)`);
  if (overrides.coasters.length > 0) log(`  applied ${overrides.coasters.length} coaster override(s)`);

  const validation = validateCatalog({
    parks,
    coasters,
    sourceRunId: raw.runId,
  });

  ({ parks, coasters } = applyQualityScores(parks, coasters, validation.report.findings));

  const runDir = processedRunDir("wikidata", raw.runId, dataRoot);
  await mkdir(runDir, { recursive: true });

  const generatedAt = new Date().toISOString();
  const parksOutput: CanonicalParkList = { version: 1, generatedAt, parks };
  const coastersOutput: CanonicalCoasterList = { version: 1, generatedAt, coasters };

  await writeFile(join(runDir, "parks.json"), JSON.stringify(parksOutput, null, 2), "utf8");
  await writeFile(join(runDir, "coasters.json"), JSON.stringify(coastersOutput, null, 2), "utf8");
  await writeFile(
    join(runDir, "meta.json"),
    JSON.stringify(
      {
        generatedAt,
        sourceRunId: raw.runId,
        sourceGeneratedAt: raw.meta.generatedAt,
        parkCount: parks.length,
        coasterCount: coasters.length,
        warnings: [...mapped.warnings],
        overrideCounts: {
          parks: overrides.parks.length,
          coasters: overrides.coasters.length,
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  log(`Done → ${runDir}`);

  return {
    runDir,
    sourceRunId: raw.runId,
    parkCount: parks.length,
    coasterCount: coasters.length,
    warnings: mapped.warnings,
  };
}
