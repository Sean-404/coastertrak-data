import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { AiReviewReport } from "../ai/types.js";

import type { CanonicalCoaster } from "../canonical/coaster.js";
import type { CanonicalPark } from "../canonical/park.js";
import {
  AI_REVIEW_BATCH_SIZE,
  AI_REVIEW_COST_ESTIMATE_PER_1M,
  AI_REVIEW_DEFAULT_LIMIT,
  AI_REVIEW_DEFAULT_MODEL,
  AI_REVIEW_MAX_LIMIT,
} from "../ai/config.js";
import { estimateTokens, reviewBatchWithGateway } from "../ai/gateway-client.js";
import {
  buildReviewItemContext,
  selectItemsForAiReview,
} from "../ai/review-context.js";
import { logger } from "../lib/logger.js";
import { processedRunDir, reviewDir } from "../lib/paths.js";
import type { ReviewQueue } from "../matching/types.js";

export type AiReviewOptions = {
  dataRoot?: string;
  source?: "supabase" | "wikidata";
  runId?: string;
  limit?: number;
  includeDuplicates?: boolean;
  model?: string;
  dryRun?: boolean;
  onProgress?: (message: string) => void;
};

function clampLimit(limit: number | undefined): number {
  const n = limit ?? AI_REVIEW_DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(n), 1), AI_REVIEW_MAX_LIMIT);
}

function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * AI_REVIEW_COST_ESTIMATE_PER_1M.input +
    (outputTokens / 1_000_000) * AI_REVIEW_COST_ESTIMATE_PER_1M.output
  );
}

async function latestSupabaseRunId(dataRoot: string): Promise<string> {
  const { readdir } = await import("node:fs/promises");
  const root = join(dataRoot, "processed", "supabase");
  const entries = await readdir(root);
  const runId = entries.filter(Boolean).sort().at(-1);
  if (!runId) throw new Error("No processed supabase run — run analyze:supabase first");
  return runId;
}

async function loadCatalog(runDir: string): Promise<{
  parks: CanonicalPark[];
  coasters: CanonicalCoaster[];
  sourceRunId: string;
}> {
  const parksRaw = JSON.parse(await readFile(join(runDir, "parks.json"), "utf8")) as {
    parks: CanonicalPark[];
  };
  const coastersRaw = JSON.parse(await readFile(join(runDir, "coasters.json"), "utf8")) as {
    coasters: CanonicalCoaster[];
  };
  const meta = JSON.parse(await readFile(join(runDir, "meta.json"), "utf8")) as { runId: string };
  return {
    parks: parksRaw.parks,
    coasters: coastersRaw.coasters,
    sourceRunId: meta.runId,
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export async function runAiCatalogReview(options: AiReviewOptions = {}): Promise<AiReviewReport> {
  const dataRoot = options.dataRoot ?? "data";
  const source = options.source ?? "supabase";
  const log = options.onProgress ?? ((msg: string) => logger.info(msg));
  const limit = clampLimit(options.limit);
  const includeDuplicates = options.includeDuplicates === true;
  const model = options.model ?? process.env.AI_GATEWAY_MODEL?.trim() ?? AI_REVIEW_DEFAULT_MODEL;

  const runId = options.runId ?? (await latestSupabaseRunId(dataRoot));
  const runDir = processedRunDir(source, runId, dataRoot);
  const queue = JSON.parse(
    await readFile(join(reviewDir(dataRoot), "queue.json"), "utf8"),
  ) as ReviewQueue;

  const { parks, coasters, sourceRunId } = await loadCatalog(runDir);
  const parksById = new Map(parks.map((p) => [p.id, p]));
  const coastersById = new Map(coasters.map((c) => [c.id, c]));

  const selected = selectItemsForAiReview(queue.items, limit, includeDuplicates);
  if (!selected.length) {
    throw new Error("No review items selected for AI review");
  }

  const indexed = selected.map((item, selIndex) => {
    const queueIndex = queue.items.findIndex(
      (q) => q === item || (q.type === item.type && "entityId" in q && "entityId" in item && q.entityId === item.entityId),
    );
    return { item, index: queueIndex >= 0 ? queueIndex : selIndex };
  });
  const contexts = indexed.map(({ item, index }) =>
    buildReviewItemContext(item, index >= 0 ? index : 0, parksById, coastersById),
  );

  const batches = chunk(contexts, AI_REVIEW_BATCH_SIZE);
  const estimatedInput = estimateTokens(JSON.stringify(contexts)) + batches.length * 400;
  const estimatedOutput = batches.length * 250;
  const estimatedCost = estimateCostUsd(estimatedInput, estimatedOutput);

  log(
    `AI review: ${selected.length} items in ${batches.length} batch(es), model=${model}, est. ~$${estimatedCost.toFixed(4)}`,
  );

  if (options.dryRun) {
    log("Dry run — no API calls made");
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      sourceRunId,
      model,
      itemsRequested: selected.length,
      itemsReviewed: 0,
      batches: batches.length,
      estimatedInputTokens: estimatedInput,
      estimatedOutputTokens: estimatedOutput,
      estimatedCostUsd: estimatedCost,
      assessments: [],
    };
  }

  const assessments: AiReviewReport["assessments"] = [];
  let inputTokens = 0;
  let outputTokens = 0;

  for (let i = 0; i < batches.length; i++) {
    log(`  Batch ${i + 1}/${batches.length} (${batches[i]!.length} items)…`);
    const result = await reviewBatchWithGateway(batches[i], { model });
    assessments.push(...result.assessments);
    inputTokens += result.usage.input;
    outputTokens += result.usage.output;
  }

  const costUsd = estimateCostUsd(inputTokens, outputTokens);
  log(`Done — ${assessments.length} assessments, ~${inputTokens + outputTokens} tokens, ~$${costUsd.toFixed(4)}`);

  const flagged = assessments.filter((a) => !a.plausible && a.confidence !== "LOW");
  if (flagged.length) {
    log(`  ${flagged.length} likely issues flagged by AI (MEDIUM/HIGH confidence)`);
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    sourceRunId,
    model,
    itemsRequested: selected.length,
    itemsReviewed: assessments.length,
    batches: batches.length,
    estimatedInputTokens: inputTokens,
    estimatedOutputTokens: outputTokens,
    estimatedCostUsd: costUsd,
    assessments,
  };
}

export async function writeAiReviewReport(
  report: AiReviewReport,
  dataRoot = "data",
): Promise<string> {
  const path = join(reviewDir(dataRoot), "ai-review.json");
  await writeFile(path, JSON.stringify(report, null, 2), "utf8");
  return path;
}
