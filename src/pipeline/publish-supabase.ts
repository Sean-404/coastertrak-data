import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  CATALOG_QUALITY_BUCKET,
  CATALOG_QUALITY_PREFIX,
  createSupabaseClient,
} from "../lib/supabase.js";
import { logger } from "../lib/logger.js";
import { latestProcessedRunId } from "../lib/load-raw.js";
import { processedRunDir, reportDir, reviewDir } from "../lib/paths.js";
import type { ReviewQueue } from "../matching/types.js";
import type { QualityReport } from "../validate/types.js";

export type PublishOptions = {
  dataRoot?: string;
  source?: "supabase" | "wikidata";
  runId?: string;
  onProgress?: (message: string) => void;
};

export type PublishedCatalogQuality = {
  bucket: string;
  prefix: string;
  meta: {
    version: 1;
    generatedAt: string;
    source: string;
    runId: string;
    parkCount: number;
    coasterCount: number;
  };
};

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

export async function publishCatalogQuality(
  options: PublishOptions = {},
): Promise<PublishedCatalogQuality> {
  const dataRoot = options.dataRoot ?? "data";
  const source = options.source ?? "supabase";
  const log = options.onProgress ?? ((msg: string) => logger.info(msg));

  const runId =
    options.runId ??
    (await latestProcessedRunIdForSource(source, dataRoot)) ??
    (() => {
      throw new Error(`No processed ${source} run found`);
    })();

  const procDir = processedRunDir(source, runId, dataRoot);
  const repDir = reportDir(source, runId, dataRoot);
  const revDir = reviewDir(dataRoot);

  const metaRaw = await readJson<{
    generatedAt: string;
    source?: string;
    parkCount: number;
    coasterCount: number;
  }>(join(procDir, "meta.json"));
  const report = await readJson<QualityReport>(join(repDir, "report.json"));
  const reviewQueue = await readJson<ReviewQueue>(join(revDir, "queue.json"));

  let aiReview: import("../ai/types.js").AiReviewReport | null = null;
  try {
    aiReview = await readJson<import("../ai/types.js").AiReviewReport>(
      join(revDir, "ai-review.json"),
    );
  } catch {
    aiReview = null;
  }

  const bundle = {
    version: 1 as const,
    generatedAt: metaRaw.generatedAt,
    source: metaRaw.source ?? source,
    runId,
    meta: {
      parkCount: metaRaw.parkCount,
      coasterCount: metaRaw.coasterCount,
    },
    report,
    reviewQueue,
    aiReview,
  };

  const client = createSupabaseClient();
  const prefix = CATALOG_QUALITY_PREFIX;
  const bucket = CATALOG_QUALITY_BUCKET;

  const uploads: Array<[string, string]> = [
    [`${prefix}/meta.json`, JSON.stringify(bundle.meta, null, 2)],
    [`${prefix}/report.json`, JSON.stringify(report, null, 2)],
    [`${prefix}/review-queue.json`, JSON.stringify(reviewQueue, null, 2)],
    ...(aiReview ? [[`${prefix}/ai-review.json`, JSON.stringify(aiReview, null, 2)] as [string, string]] : []),
    [`${prefix}/bundle.json`, JSON.stringify(bundle, null, 2)],
  ];

  for (const [path, body] of uploads) {
    const { error } = await client.storage.from(bucket).upload(path, body, {
      contentType: "application/json",
      upsert: true,
    });
    if (error) throw new Error(`Upload failed (${path}): ${error.message}`);
    log(`Uploaded ${bucket}/${path}`);
  }

  const { data: pub } = client.storage.from(bucket).getPublicUrl(`${prefix}/bundle.json`);
  log(`Public bundle URL: ${pub.publicUrl}`);

  return {
    bucket,
    prefix,
    meta: {
      version: 1,
      generatedAt: bundle.generatedAt,
      source: bundle.source,
      runId,
      parkCount: bundle.meta.parkCount,
      coasterCount: bundle.meta.coasterCount,
    },
  };
}

async function latestProcessedRunIdForSource(
  source: string,
  dataRoot: string,
): Promise<string | null> {
  if (source === "wikidata") {
    return latestProcessedRunId(dataRoot);
  }
  const { readdir } = await import("node:fs/promises");
  const root = join(dataRoot, "processed", source);
  try {
    const entries = await readdir(root);
    return entries.filter(Boolean).sort().at(-1) ?? null;
  } catch {
    return null;
  }
}
