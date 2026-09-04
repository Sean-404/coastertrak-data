#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import {
  canonicalCoasterListSchema,
  canonicalParkListSchema,
} from "../canonical/index.js";
import { loadEnvFiles } from "../lib/load-env.js";
import { fixturesDir } from "../lib/paths.js";
import { logger } from "../lib/logger.js";
import { ingestWikidata } from "../sources/wikidata/ingest.js";
import { processRawRun } from "../pipeline/process.js";
import {
  exportCatalog,
  validateProcessedRun,
} from "../pipeline/run.js";
import { analyzeSupabaseCatalog } from "../pipeline/analyze-supabase.js";
import { runAiCatalogReview, writeAiReviewReport } from "../pipeline/ai-review.js";
import { publishCatalogQuality } from "../pipeline/publish-supabase.js";
import { renderQualityReportText } from "../validate/report-markdown.js";

type Command =
  | "ingest"
  | "process"
  | "validate"
  | "report"
  | "export"
  | "pipeline"
  | "analyze:supabase"
  | "ai:review"
  | "publish";

function parseArgs(argv: string[]): { command: Command | null; flags: Record<string, string | boolean> } {
  const [, , commandRaw, ...rest] = argv;
  const command = commandRaw as Command | undefined;
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]!;
    if (arg === "--dry-run") flags.dryRun = true;
    else if (arg === "--live") flags.fixture = false;
    else if (arg === "--fixture") flags.fixture = true;
    else if (arg === "--fixtures") flags.fixtures = true;
    else if (arg.startsWith("--") && rest[i + 1] && !rest[i + 1]!.startsWith("--")) {
      flags[arg.slice(2)] = rest[++i]!;
    } else if (arg.startsWith("--")) {
      flags[arg.slice(2)] = true;
    }
  }

  return { command: command ?? null, flags };
}

function getRunId(flags: Record<string, string | boolean>): string | undefined {
  const runId = flags.runId ?? flags["run-id"];
  return typeof runId === "string" ? runId : undefined;
}

async function cmdIngest(flags: Record<string, string | boolean>): Promise<void> {
  const fixture = flags.fixture !== false && flags.live !== true;
  const dryRun = flags.dryRun === true;
  const maxRows = flags.maxRows ? Number(flags.maxRows) : undefined;

  await ingestWikidata({
    fixture,
    dryRun,
    maxRows: Number.isFinite(maxRows) ? maxRows : undefined,
    onProgress: (msg) => logger.info(msg),
  });
}

async function cmdProcess(flags: Record<string, string | boolean>): Promise<void> {
  await processRawRun({
    sourceRunId: getRunId(flags),
    onProgress: (msg) => logger.info(msg),
  });
}

async function validateFixtures(): Promise<boolean> {
  const canonicalDir = join(fixturesDir(), "canonical");
  const files = (await readdir(canonicalDir)).filter((f: string) => f.endsWith(".json"));

  let errors = 0;
  for (const file of files) {
    const path = join(canonicalDir, file);
    const raw = JSON.parse(await readFile(path, "utf8"));

    if (file.includes("park")) {
      const result = canonicalParkListSchema.safeParse(raw);
      if (!result.success) {
        logger.error(`Invalid park fixture: ${file}`, { issues: result.error.issues });
        errors++;
      } else {
        logger.info(`Validated fixture ${file}`, { parks: result.data.parks.length });
      }
    } else if (file.includes("coaster")) {
      const result = canonicalCoasterListSchema.safeParse(raw);
      if (!result.success) {
        logger.error(`Invalid coaster fixture: ${file}`, { issues: result.error.issues });
        errors++;
      } else {
        logger.info(`Validated fixture ${file}`, { coasters: result.data.coasters.length });
      }
    }
  }

  return errors === 0;
}

async function cmdValidate(flags: Record<string, string | boolean>): Promise<void> {
  if (flags.fixtures === true) {
    const ok = await validateFixtures();
    if (!ok) process.exitCode = 1;
    return;
  }

  const result = await validateProcessedRun({
    sourceRunId: getRunId(flags),
    onProgress: (msg) => logger.info(msg),
  });

  console.log(renderQualityReportText(result.report));

  if (!result.passed) {
    logger.warn("Validation completed with errors");
    process.exitCode = 1;
  }
}

async function cmdReport(flags: Record<string, string | boolean>): Promise<void> {
  const result = await validateProcessedRun({
    sourceRunId: getRunId(flags),
    onProgress: (msg) => logger.info(msg),
  });
  console.log(renderQualityReportText(result.report));
}

async function cmdExport(flags: Record<string, string | boolean>): Promise<void> {
  await exportCatalog({
    sourceRunId: getRunId(flags),
    onProgress: (msg) => logger.info(msg),
  });
}

async function cmdPublish(flags: Record<string, string | boolean>): Promise<void> {
  const source = flags.wikidata === true ? "wikidata" : "supabase";
  await publishCatalogQuality({
    source,
    runId: getRunId(flags),
    onProgress: (msg) => logger.info(msg),
  });
}

async function cmdAiReview(flags: Record<string, string | boolean>): Promise<void> {
  const limit = flags.limit ? Number(flags.limit) : undefined;
  const report = await runAiCatalogReview({
    runId: getRunId(flags),
    limit: Number.isFinite(limit) ? limit : undefined,
    includeDuplicates: flags["include-duplicates"] === true,
    includeMissing: flags["include-missing"] === true,
    dryRun: flags.dryRun === true,
    onProgress: (msg) => logger.info(msg),
  });
  if (flags.dryRun !== true) {
    const path = await writeAiReviewReport(report);
    logger.info(`AI review → ${path}`);
  }
  console.log(
    JSON.stringify(
      {
        itemsReviewed: report.itemsReviewed,
        estimatedCostUsd: report.estimatedCostUsd,
        flagged: report.assessments.filter((a) => !a.plausible && a.confidence !== "LOW").length,
      },
      null,
      2,
    ),
  );
}

async function cmdAnalyzeSupabase(): Promise<void> {
  const result = await analyzeSupabaseCatalog({
    onProgress: (msg) => logger.info(msg),
  });
  console.log(renderQualityReportText(
    JSON.parse(
      await readFile(join(result.reportDir, "report.json"), "utf8"),
    ),
  ));
  if (!result.passed) process.exitCode = 1;
}

async function cmdPipeline(flags: Record<string, string | boolean>): Promise<void> {
  await cmdIngest(flags);
  await cmdProcess(flags);
  await cmdValidate(flags);
  await cmdExport(flags);
}

async function main(): Promise<void> {
  loadEnvFiles();
  const { command, flags } = parseArgs(process.argv);

  if (!command) {
    console.log(`Usage: npm run <command>

Commands:
  ingest    Copy fixtures (default) or fetch Wikidata (--live)
  process   Map raw data to canonical entities and apply overrides
  validate  Validate latest processed catalog and write review queue
  report    Print quality report for latest processed run
  export    Export canonical dataset to data/output/
  analyze:supabase  Read live Supabase catalog, validate, write review queue
  publish   Upload latest quality report to Supabase Storage (for admin UI)
  pipeline  Run ingest → process → validate → export

Flags:
  --fixture       Use fixture data for ingest (default)
  --live          Query Wikidata live
  --dry-run       Log ingest actions without writing files
  --fixtures      Validate committed fixture JSON only (validate command)
  --run-id <id>   Target a specific raw/processed run
  --max-rows N    Limit live Wikidata ingest rows
  --limit N       AI review item cap (default 20, max 40)
  --include-duplicates  Include duplicate candidates in AI review
  --include-missing     Include MISSING_DATA field gaps in AI review
  --dry-run       Preview AI cost without calling the gateway
`);
    process.exitCode = 1;
    return;
  }

  switch (command) {
    case "ingest":
      await cmdIngest(flags);
      break;
    case "process":
      await cmdProcess(flags);
      break;
    case "validate":
      await cmdValidate(flags);
      break;
    case "report":
      await cmdReport(flags);
      break;
    case "export":
      await cmdExport(flags);
      break;
    case "publish":
      await cmdPublish(flags);
      break;
    case "analyze:supabase":
      await cmdAnalyzeSupabase();
      break;
    case "ai:review":
      await cmdAiReview(flags);
      break;
    case "pipeline":
      await cmdPipeline(flags);
      break;
    default:
      logger.error(`Unknown command: ${command}`);
      process.exitCode = 1;
  }
}

main().catch((error) => {
  logger.error("CLI failed", { error: String(error) });
  process.exitCode = 1;
});
