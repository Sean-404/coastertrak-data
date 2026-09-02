import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { CanonicalCoasterList } from "../canonical/coaster.js";
import type { CanonicalParkList } from "../canonical/park.js";
import { applyQualityScores } from "../confidence/score.js";
import { logger } from "../lib/logger.js";
import { newRunId, processedRunDir, reportDir, reviewDir } from "../lib/paths.js";
import type { ReviewQueue } from "../matching/types.js";
import { exportCatalogFromSupabase } from "../sources/supabase/export.js";
import { renderQualityReportMarkdown } from "../validate/report-markdown.js";
import { validateCatalog } from "../validate/rules.js";

export type AnalyzeSupabaseOptions = {
  dataRoot?: string;
  runId?: string;
  onProgress?: (message: string) => void;
};

export type AnalyzeSupabaseResult = {
  runId: string;
  runDir: string;
  reportDir: string;
  parkCount: number;
  coasterCount: number;
  skippedParks: number;
  passed: boolean;
};

export async function analyzeSupabaseCatalog(
  options: AnalyzeSupabaseOptions = {},
): Promise<AnalyzeSupabaseResult> {
  const dataRoot = options.dataRoot ?? "data";
  const runId = options.runId ?? newRunId();
  const log = options.onProgress ?? ((msg: string) => logger.info(msg));

  log("Exporting catalog from Supabase (read-only)…");
  const exported = await exportCatalogFromSupabase();
  log(`  ${exported.parks.length} parks, ${exported.coasters.length} coasters (${exported.skippedParks} parks skipped — unmapped country)`);

  const validation = validateCatalog({
    parks: exported.parks,
    coasters: exported.coasters,
    sourceRunId: runId,
  });

  const scored = applyQualityScores(
    exported.parks,
    exported.coasters,
    validation.report.findings,
  );

  const generatedAt = new Date().toISOString();
  const runDir = processedRunDir("supabase", runId, dataRoot);
  await mkdir(runDir, { recursive: true });

  const parksOutput: CanonicalParkList = {
    version: 1,
    generatedAt,
    parks: scored.parks,
  };
  const coastersOutput: CanonicalCoasterList = {
    version: 1,
    generatedAt,
    coasters: scored.coasters,
  };

  await writeFile(join(runDir, "parks.json"), JSON.stringify(parksOutput, null, 2), "utf8");
  await writeFile(join(runDir, "coasters.json"), JSON.stringify(coastersOutput, null, 2), "utf8");
  await writeFile(
    join(runDir, "meta.json"),
    JSON.stringify(
      {
        generatedAt,
        source: "coastertrak_supabase",
        runId,
        parkCount: scored.parks.length,
        coasterCount: scored.coasters.length,
        skippedParks: exported.skippedParks,
      },
      null,
      2,
    ),
    "utf8",
  );

  const runReportDir = reportDir("supabase", runId, dataRoot);
  await mkdir(runReportDir, { recursive: true });
  await writeFile(
    join(runReportDir, "report.json"),
    JSON.stringify(validation.report, null, 2),
    "utf8",
  );
  await writeFile(
    join(runReportDir, "report.md"),
    renderQualityReportMarkdown(validation.report),
    "utf8",
  );

  const reviewRoot = reviewDir(dataRoot);
  await mkdir(reviewRoot, { recursive: true });

  const queue: ReviewQueue = {
    version: 1,
    generatedAt,
    items: validation.reviewItems,
  };

  const duplicateParks = validation.reviewItems.filter(
    (i) => i.type === "POSSIBLE_DUPLICATE" && i.entityType === "park",
  );
  const duplicateCoasters = validation.reviewItems.filter(
    (i) => i.type === "POSSIBLE_DUPLICATE" && i.entityType === "coaster",
  );
  const countryConflicts = validation.reviewItems.filter((i) => i.type === "COUNTRY_CONFLICT");
  const suspiciousValues = validation.reviewItems.filter((i) => i.type === "SUSPICIOUS_VALUE");
  const missingData = validation.reviewItems.filter((i) => i.type === "MISSING_DATA");

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

  return {
    runId,
    runDir,
    reportDir: runReportDir,
    parkCount: scored.parks.length,
    coasterCount: scored.coasters.length,
    skippedParks: exported.skippedParks,
    passed: validation.passed,
  };
}
