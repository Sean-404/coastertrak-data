import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  canonicalCoasterListSchema,
  type CanonicalCoasterList,
} from "../canonical/coaster.js";
import { canonicalParkListSchema, type CanonicalParkList } from "../canonical/park.js";
import { latestProcessedRunId } from "../lib/load-raw.js";
import { logger } from "../lib/logger.js";
import { outputDir, processedRunDir, reportDir, reviewDir } from "../lib/paths.js";
import type { ReviewQueue } from "../matching/types.js";
import {
  mapCoasterToCoasterTrakExport,
  mapParkToCoasterTrakExport,
  type CoasterTrakCatalogExport,
} from "../export/coastertrak.js";
import { renderQualityReportMarkdown } from "../validate/report-markdown.js";
import { validateCatalog } from "../validate/rules.js";
import type { QualityReport } from "../validate/types.js";

export type LoadedProcessed = {
  runId: string;
  parks: CanonicalParkList;
  coasters: CanonicalCoasterList;
};

export async function loadProcessedRun(
  runId: string,
  dataRoot = "data",
): Promise<LoadedProcessed> {
  const runDir = processedRunDir("wikidata", runId, dataRoot);
  const parks = canonicalParkListSchema.parse(
    JSON.parse(await readFile(join(runDir, "parks.json"), "utf8")),
  );
  const coasters = canonicalCoasterListSchema.parse(
    JSON.parse(await readFile(join(runDir, "coasters.json"), "utf8")),
  );
  return { runId, parks, coasters };
}

export async function loadLatestProcessed(dataRoot = "data"): Promise<LoadedProcessed> {
  const runId = await latestProcessedRunId(dataRoot);
  if (!runId) throw new Error("No processed run found. Run npm run process first.");
  return loadProcessedRun(runId, dataRoot);
}

export type ValidateRunOptions = {
  dataRoot?: string;
  sourceRunId?: string;
  onProgress?: (message: string) => void;
};

export type ValidateRunResult = {
  report: QualityReport;
  reportDir: string;
  passed: boolean;
};

export async function validateProcessedRun(
  options: ValidateRunOptions = {},
): Promise<ValidateRunResult> {
  const dataRoot = options.dataRoot ?? "data";
  const log = options.onProgress ?? ((msg: string) => logger.info(msg));

  const processed = options.sourceRunId
    ? await loadProcessedRun(options.sourceRunId, dataRoot)
    : await loadLatestProcessed(dataRoot);

  log(`Validating processed run ${processed.runId}…`);

  const result = validateCatalog({
    parks: processed.parks.parks,
    coasters: processed.coasters.coasters,
    sourceRunId: processed.runId,
  });

  const runReportDir = reportDir("wikidata", processed.runId, dataRoot);
  await mkdir(runReportDir, { recursive: true });

  await writeFile(
    join(runReportDir, "report.json"),
    JSON.stringify(result.report, null, 2),
    "utf8",
  );
  await writeFile(
    join(runReportDir, "report.md"),
    renderQualityReportMarkdown(result.report),
    "utf8",
  );

  const reviewRoot = reviewDir(dataRoot);
  await mkdir(reviewRoot, { recursive: true });

  const queue: ReviewQueue = {
    version: 1,
    generatedAt: result.report.generatedAt,
    items: result.reviewItems,
  };

  const duplicateParks = result.reviewItems.filter(
    (i) => i.type === "POSSIBLE_DUPLICATE" && i.entityType === "park",
  );
  const duplicateCoasters = result.reviewItems.filter(
    (i) => i.type === "POSSIBLE_DUPLICATE" && i.entityType === "coaster",
  );
  const countryConflicts = result.reviewItems.filter((i) => i.type === "COUNTRY_CONFLICT");
  const suspiciousValues = result.reviewItems.filter((i) => i.type === "SUSPICIOUS_VALUE");
  const missingData = result.reviewItems.filter((i) => i.type === "MISSING_DATA");

  await Promise.all([
    writeFile(join(reviewRoot, "duplicate-parks.json"), JSON.stringify(duplicateParks, null, 2)),
    writeFile(
      join(reviewRoot, "duplicate-coasters.json"),
      JSON.stringify(duplicateCoasters, null, 2),
    ),
    writeFile(
      join(reviewRoot, "country-conflicts.json"),
      JSON.stringify(countryConflicts, null, 2),
    ),
    writeFile(
      join(reviewRoot, "suspicious-values.json"),
      JSON.stringify(suspiciousValues, null, 2),
    ),
    writeFile(join(reviewRoot, "missing-data.json"), JSON.stringify(missingData, null, 2)),
    writeFile(join(reviewRoot, "queue.json"), JSON.stringify(queue, null, 2)),
  ]);

  log(`Report → ${runReportDir}`);
  log(`Review queue → ${reviewRoot}`);

  return { report: result.report, reportDir: runReportDir, passed: result.passed };
}

export type ExportOptions = {
  dataRoot?: string;
  sourceRunId?: string;
  onProgress?: (message: string) => void;
};

export async function exportCatalog(options: ExportOptions = {}): Promise<string> {
  const dataRoot = options.dataRoot ?? "data";
  const log = options.onProgress ?? ((msg: string) => logger.info(msg));

  const processed = options.sourceRunId
    ? await loadProcessedRun(options.sourceRunId, dataRoot)
    : await loadLatestProcessed(dataRoot);

  log(`Exporting processed run ${processed.runId}…`);

  const outDir = outputDir(dataRoot);
  await mkdir(outDir, { recursive: true });

  const generatedAt = new Date().toISOString();

  await writeFile(
    join(outDir, "parks.json"),
    JSON.stringify(processed.parks, null, 2),
    "utf8",
  );
  await writeFile(
    join(outDir, "coasters.json"),
    JSON.stringify(processed.coasters, null, 2),
    "utf8",
  );

  const coasterTrakExport: CoasterTrakCatalogExport = {
    version: 1,
    generatedAt,
    parks: processed.parks.parks.map((p) => {
      try {
        return mapParkToCoasterTrakExport(p);
      } catch {
        return null;
      }
    }).filter((p): p is NonNullable<typeof p> => p != null),
    coasters: processed.coasters.coasters.map((c) => mapCoasterToCoasterTrakExport(c)),
  };

  await writeFile(
    join(outDir, "coastertrak-export.json"),
    JSON.stringify(coasterTrakExport, null, 2),
    "utf8",
  );
  await writeFile(
    join(outDir, "meta.json"),
    JSON.stringify(
      {
        version: 1,
        generatedAt,
        sourceRunId: processed.runId,
        parkCount: processed.parks.parks.length,
        coasterCount: processed.coasters.coasters.length,
      },
      null,
      2,
    ),
    "utf8",
  );

  log(`Export → ${outDir}`);
  return outDir;
}
